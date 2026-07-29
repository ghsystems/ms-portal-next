import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth0 } from "@auth0/auth0-react";
import { reportTypes, type ReportType } from "@/components/portal/portal-data";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PortalIcon } from "@/components/portal/portal-ui";
import { formatDate } from "@/components/portal/portal-utils";
import { API_BASE_URL } from "@/lib/api";
import { toast } from "sonner";
import { sharepointCache } from "@/lib/sharepoint-cache";

type Report = {
  id: string;
  title: string;
  type: ReportType;
  report_date: string;
  client_id: string;
  is_published: boolean;
  published_by_email: string;
  created_at: string;
  clients: { name: string } | null;
};

const TYPE_LABEL: Record<ReportType, string> = {
  "Monthly Managed Services Report": "Monthly",
  "Major Incident Report": "MIR",
  "Annual SOC 2 Report": "SOC 2",
  Invoice: "Invoice",
};

function AdminReportsTableSkeleton() {
  return (
    <div className="space-y-3 p-8" role="status" aria-label="Loading reports">
      {[...Array(5)].map((_, index) => (
        <div key={index} className="flex items-center gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
      ))}
      <span className="sr-only">Loading reports</span>
    </div>
  );
}

export default function AdminReportsView() {
  const { getAccessTokenSilently } = useAuth0();
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [filterTitle, setFilterTitle] = useState("");
  const [filterType, setFilterType] = useState<ReportType | "">("");
  const [filterClient, setFilterClient] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<
    "" | "published" | "unpublished"
  >("");
  const [filterYear, setFilterYear] = useState("");

  // unpublish confirm
  const [unpublishTarget, setUnpublishTarget] = useState<Report | null>(null);
  const [unpublishSubmitting, setUnpublishSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessTokenSilently();
      const resp = await fetch(`${API_BASE_URL}/list-reports`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.error ?? "Failed to load reports");
      }
      setReports(data.reports ?? []);
    } catch (err) {
      setReports([]);
      setError(err instanceof Error ? err.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, [getAccessTokenSilently]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // prefetch root SharePoint folder in background so the publish page loads instantly
  useEffect(() => {
    if (sharepointCache.get(null)) return;
    async function prefetchSharePointRoot() {
      try {
        const token = await getAccessTokenSilently();
        const resp = await fetch(`${API_BASE_URL}/list-sharepoint-files`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok && data.items) sharepointCache.set(null, data.items);
      } catch {
        // Non-blocking warmup for the publish view.
      }
    }
    prefetchSharePointRoot();
  }, [getAccessTokenSilently]);

  // derive filter options from loaded data
  const clientOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of reports) {
      if (r.client_id && r.clients?.name) map.set(r.client_id, r.clients.name);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [reports]);

  const filteredClientOptions = useMemo(
    () =>
      clientSearch
        ? clientOptions.filter(([, name]) =>
            name.toLowerCase().includes(clientSearch.toLowerCase()),
          )
        : clientOptions,
    [clientOptions, clientSearch],
  );

  const yearOptions = useMemo(() => {
    const years = new Set(
      reports
        .map((r) => r.report_date?.slice(0, 4))
        .filter(Boolean) as string[],
    );
    return Array.from(years).sort().reverse();
  }, [reports]);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (
        filterTitle &&
        !r.title.toLowerCase().includes(filterTitle.toLowerCase())
      )
        return false;
      if (filterType && r.type !== filterType) return false;
      if (filterClient && r.client_id !== filterClient) return false;
      if (filterStatus === "published" && !r.is_published) return false;
      if (filterStatus === "unpublished" && r.is_published) return false;
      if (filterYear && !r.report_date?.startsWith(filterYear)) return false;
      return true;
    });
  }, [
    reports,
    filterTitle,
    filterType,
    filterClient,
    filterStatus,
    filterYear,
  ]);

  const hasFilters =
    filterTitle || filterType || filterClient || filterStatus || filterYear;

  function selectClient(id: string, name: string) {
    setFilterClient(id);
    setClientSearch(name);
    setClientDropdownOpen(false);
  }

  function clearClientFilter() {
    setFilterClient("");
    setClientSearch("");
    setClientDropdownOpen(false);
  }

  function handleClientBlur() {
    setTimeout(() => {
      setClientDropdownOpen(false);
      // snap input back to the selected client's name (or clear if none)
      const name = clientOptions.find(([id]) => id === filterClient)?.[1] ?? "";
      setClientSearch(name);
    }, 150);
  }

  function clearFilters() {
    setFilterTitle("");
    setFilterType("");
    setFilterClient("");
    setClientSearch("");
    setFilterStatus("");
    setFilterYear("");
  }

  async function setPublished(report: Report, publish: boolean) {
    const verb = publish ? "republish" : "unpublish";
    setUnpublishSubmitting(true);
    try {
      const token = await getAccessTokenSilently();
      const resp = await fetch(`${API_BASE_URL}/unpublish-report`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: report.id, publish }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? `${verb} failed`);
      toast.success(`"${report.title}" ${publish ? "republished" : "unpublished"}.`);
      setUnpublishTarget(null);
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `${verb} failed`);
    } finally {
      setUnpublishSubmitting(false);
    }
  }

  const publishedReports = reports.filter((r) => r.is_published);
  const thisMonth = publishedReports.filter((r) =>
    r.report_date?.startsWith(new Date().toISOString().slice(0, 7)),
  );

  return (
    <>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-4xl font-light text-foreground tracking-normal">
            Reports
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Publish and manage reports visible to client portals.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => router.push("/admin/reports/publish")}
        >
          <span className="text-base leading-none">+</span>
          Publish Report
        </Button>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-border bg-card/40 p-6 shadow-lg shadow-black/5 backdrop-blur-2xl backdrop-saturate-50">
          <p className="text-sm font-bold uppercase tracking-wider text-foreground">
            Published
          </p>
          {loading ? (
            <Skeleton className="mt-3 h-10 w-16" />
          ) : (
            <p className="mt-2 font-display text-4xl text-foreground">
              {publishedReports.length}
            </p>
          )}
        </div>
        <div className="rounded-3xl border border-border bg-card/40 p-6 shadow-lg shadow-black/5 backdrop-blur-2xl backdrop-saturate-50">
          <p className="text-sm font-bold uppercase tracking-wider text-foreground">
            This Month
          </p>
          {loading ? (
            <Skeleton className="mt-3 h-10 w-16" />
          ) : (
            <p className="mt-2 font-display text-4xl text-foreground">
              {thisMonth.length}
            </p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clipRule="evenodd"
            />
          </svg>
          <input
            type="search"
            value={filterTitle}
            onChange={(e) => setFilterTitle(e.target.value)}
            placeholder="Search title"
            className="h-9 rounded-xl bg-muted pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:ring-2 focus:ring-slate-100"
          />
        </div>

        <Select
          value={filterType || null}
          onValueChange={(v) => setFilterType((v ?? "") as ReportType | "")}
        >
          <SelectTrigger className="h-9 w-auto border-transparent bg-muted">
            <SelectValue placeholder="Report type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>All types</SelectItem>
            {reportTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {TYPE_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {clientOptions.length > 0 && (
          <div className="relative">
            <input
              type="text"
              value={clientSearch}
              onChange={(e) => {
                setClientSearch(e.target.value);
                setClientDropdownOpen(true);
                if (!e.target.value) setFilterClient("");
              }}
              onFocus={() => setClientDropdownOpen(true)}
              onBlur={handleClientBlur}
              placeholder="All clients"
              className="h-9 w-44 rounded-xl bg-muted px-3 pr-7 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:ring-2 focus:ring-slate-100"
            />
            {filterClient ? (
              <button
                type="button"
                onMouseDown={clearClientFilter}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                aria-label="Clear client filter"
              >
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            ) : (
              <svg
                className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            {clientDropdownOpen && (
              <div className="absolute z-20 mt-1 max-h-52 w-full min-w-max overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
                {filteredClientOptions.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    No clients found
                  </p>
                ) : (
                  filteredClientOptions.map(([id, name]) => (
                    <button
                      key={id}
                      type="button"
                      onMouseDown={() => selectClient(id, name)}
                      className={`w-full px-3 py-2 text-left text-sm transition hover:bg-muted ${filterClient === id ? "font-semibold text-foreground" : "text-foreground"}`}
                    >
                      {name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {yearOptions.length > 0 && (
          <Select
            value={filterYear || null}
            onValueChange={(v) => setFilterYear(v ?? "")}
          >
            <SelectTrigger className="h-9 w-auto border-transparent bg-muted">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>All years</SelectItem>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
          value={filterStatus || null}
          onValueChange={(v) =>
            setFilterStatus((v ?? "") as "" | "published" | "unpublished")
          }
        >
          <SelectTrigger className="h-9 w-auto border-transparent bg-muted">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>All statuses</SelectItem>
            <SelectItem value="published">Active</SelectItem>
            <SelectItem value="unpublished">Inactive</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            type="button"
            onClick={clearFilters}
            variant="outline"
            size="sm"
            className="h-9 rounded-xl text-muted-foreground hover:text-foreground"
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
            Clear
          </Button>
        )}

        {hasFilters && !loading && (
          <span className="text-sm text-muted-foreground">
            {filteredReports.length} of {reports.length}
          </span>
        )}
      </div>

      <div className="data-table-shell mt-3">
        {loading ? (
          <AdminReportsTableSkeleton />
        ) : error ? (
          <div className="data-table-empty">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <PortalIcon name="reports" className="h-7 w-7" />
            </div>
            <p className="mt-5 text-sm text-rose-600">{error}</p>
            <Button
              type="button"
              onClick={loadData}
              variant="outline"
              size="sm"
              className="mt-4 rounded-xl"
            >
              Retry
            </Button>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="data-table-empty">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <PortalIcon name="reports" className="h-7 w-7" />
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              {hasFilters
                ? "No reports match the current filters."
                : 'No reports published yet. Click "Publish Report" to get started.'}
            </p>
          </div>
        ) : (
          <table className="w-full caption-bottom text-sm">
            <thead>
              <tr className="data-table-header text-left">
                <th className="data-table-header-cell">Title</th>
                <th className="data-table-header-cell">Type</th>
                <th className="data-table-header-cell">Date</th>
                <th className="data-table-header-cell">Client</th>
                <th className="data-table-header-cell">Published By</th>
                <th className="data-table-header-cell">Status</th>
                <th className="data-table-header-cell" />
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((r) => (
                <tr key={r.id} className="data-table-row">
                  <td className="data-table-cell max-w-xs truncate font-medium text-foreground">
                    {r.title}
                  </td>
                  <td className="data-table-cell">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                      {TYPE_LABEL[r.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {formatDate(r.report_date)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.clients?.name ?? "-"}
                  </td>
                  <td className="data-table-cell text-muted-foreground">
                    {r.published_by_email}
                  </td>
                  <td className="data-table-cell">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.is_published ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}`}
                    >
                      {r.is_published ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="data-table-cell text-right">
                    {r.is_published ? (
                      <Button
                        type="button"
                        onClick={() => setUnpublishTarget(r)}
                        variant="destructive"
                        size="sm"
                        className="rounded-lg"
                      >
                        Unpublish
                      </Button>
                    ) : (
                      // ponytail: no confirm dialog — republishing is reversible
                      <Button
                        type="button"
                        onClick={() => setPublished(r, true)}
                        disabled={unpublishSubmitting}
                        variant="outline"
                        size="sm"
                        className="rounded-lg"
                      >
                        Republish
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog
        open={!!unpublishTarget}
        onOpenChange={(open) => {
          if (!open) {
            setUnpublishTarget(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Unpublish Report</DialogTitle>
            <DialogDescription>
              "{unpublishTarget?.title}" will be removed from the client's
              portal. The SharePoint file is unaffected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose className="rounded-full border border-border px-5 py-2.5 text-sm text-foreground transition hover:border-border hover:bg-muted">
              Cancel
            </DialogClose>
            <Button
              type="button"
              onClick={() => unpublishTarget && setPublished(unpublishTarget, false)}
              disabled={unpublishSubmitting}
              variant="destructive"
            >
              {unpublishSubmitting ? "Removing" : "Unpublish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
