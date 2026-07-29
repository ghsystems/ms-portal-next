import { useEffect, useRef, useState, useMemo, Fragment } from "react";
import { useRouter } from "next/navigation";
import { useAuth0 } from "@auth0/auth0-react";
import { reportTypes, type ReportType } from "@/components/portal/portal-data";
import { API_BASE_URL } from "@/lib/api";
import { sharepointCache, type BrowserItem } from "@/lib/sharepoint-cache";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type Client = { id: string; name: string };

const TYPE_LABEL: Record<ReportType, string> = {
  "Monthly Managed Services Report": "Monthly",
  "Major Incident Report": "MIR",
  "Annual SOC 2 Report": "SOC 2",
  Invoice: "Invoice",
};

const PAGE_SIZE = 50;

function SharePointBrowserSkeleton() {
  return (
    <div
      className="space-y-2 p-4"
      role="status"
      aria-label="Loading SharePoint files"
    >
      {[...Array(10)].map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 rounded-xl px-2 py-1"
        >
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
      <span className="sr-only">Loading SharePoint files</span>
    </div>
  );
}

function stripExt(name: string) {
  return name.replace(/\.[^.]+$/, "");
}

function fmtSize(bytes: number) {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export default function AdminReportsPublishView() {
  const { getAccessTokenSilently } = useAuth0();
  const router = useRouter();
  const selectAllRef = useRef<HTMLInputElement>(null);

  const [clients, setClients] = useState<Client[]>([]);

  // browser
  const [browserStack, setBrowserStack] = useState<
    Array<{ id: string | null; name: string }>
  >([{ id: null, name: "SharePoint" }]);
  const [browserItems, setBrowserItems] = useState<BrowserItem[]>(
    () => sharepointCache.get(null) ?? [],
  );
  const [browserLoading, setBrowserLoading] = useState(
    () => !sharepointCache.get(null),
  );
  const [browserError, setBrowserError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);

  // selection persists across folder navigation
  const [selectedFiles, setSelectedFiles] = useState<BrowserItem[]>([]);

  // form
  const [type, setType] = useState<ReportType>(reportTypes[0]);
  const [date, setDate] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const token = await getAccessTokenSilently();
        const h = { Authorization: `Bearer ${token}` };

        // clients always needed fresh; files only if not cached
        const cached = sharepointCache.get(null);
        const fetches: Promise<Response>[] = [
          fetch(`${API_BASE_URL}/list-clients`, { headers: h }),
        ];
        if (!cached)
          fetches.push(
            fetch(`${API_BASE_URL}/list-sharepoint-files`, { headers: h }),
          );

        const responses = await Promise.all(fetches);
        const [clientsData, filesData] = await Promise.all(
          responses.map((r) => r.json()),
        );

        if (responses[0].ok) {
          const loaded: Client[] = clientsData.clients ?? [];
          setClients(loaded);
          if (loaded[0]) {
            setClientId(loaded[0].id);
            setClientSearch(loaded[0].name);
          }
        }
        if (!cached) {
          if (responses[1]?.ok) {
            const items = filesData.items ?? [];
            sharepointCache.set(null, items);
            setBrowserItems(items);
          } else {
            setBrowserError(filesData.error ?? "Failed to load files");
          }
        }
      } catch (err) {
        setBrowserError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setBrowserLoading(false);
      }
    }
    init();
  }, [getAccessTokenSilently]);

  async function loadFolder(itemId: string | null) {
    const cached = sharepointCache.get(itemId);
    if (cached) {
      setBrowserItems(cached);
      return;
    }
    setBrowserLoading(true);
    setBrowserError(null);
    try {
      const token = await getAccessTokenSilently();
      const url = `${API_BASE_URL}/list-sharepoint-files${itemId ? `?itemId=${encodeURIComponent(itemId)}` : ""}`;
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? "Failed to load folder");
      sharepointCache.set(itemId, data.items ?? []);
      setBrowserItems(data.items ?? []);
    } catch (err) {
      setBrowserError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setBrowserLoading(false);
    }
  }

  async function navigateInto(folder: BrowserItem) {
    setBrowserStack((prev) => [...prev, { id: folder.id, name: folder.name }]);
    setSearchTerm("");
    setPage(1);
    await loadFolder(folder.id);
  }

  async function navigateTo(index: number) {
    const newStack = browserStack.slice(0, index + 1);
    setBrowserStack(newStack);
    setSearchTerm("");
    setPage(1);
    await loadFolder(newStack[index].id);
  }

  function toggleFile(item: BrowserItem) {
    setSelectedFiles((prev) =>
      prev.some((f) => f.id === item.id)
        ? prev.filter((f) => f.id !== item.id)
        : [...prev, item],
    );
  }

  const sortedItems = useMemo(
    () =>
      [...browserItems].sort((a, b) => {
        if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    [browserItems],
  );

  const filteredItems = useMemo(
    () =>
      searchTerm
        ? sortedItems.filter((i) =>
            i.name.toLowerCase().includes(searchTerm.toLowerCase()),
          )
        : sortedItems,
    [sortedItems, searchTerm],
  );

  const filteredClients = useMemo(
    () =>
      clientSearch
        ? clients.filter((c) =>
            c.name.toLowerCase().includes(clientSearch.toLowerCase()),
          )
        : clients,
    [clients, clientSearch],
  );

  function selectClient(id: string, name: string) {
    setClientId(id);
    setClientSearch(name);
    setClientDropdownOpen(false);
  }

  function handleClientBlur() {
    setTimeout(() => {
      setClientDropdownOpen(false);
      setClientSearch(clients.find((c) => c.id === clientId)?.name ?? "");
    }, 150);
  }

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedItems = filteredItems.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  // reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  const visibleFiles = pagedItems.filter((i) => !i.isFolder);
  const allVisibleSelected =
    visibleFiles.length > 0 &&
    visibleFiles.every((f) => selectedFiles.some((s) => s.id === f.id));
  const someVisibleSelected =
    !allVisibleSelected &&
    visibleFiles.some((f) => selectedFiles.some((s) => s.id === f.id));

  useEffect(() => {
    if (selectAllRef.current)
      selectAllRef.current.indeterminate = someVisibleSelected;
  }, [someVisibleSelected]);

  function toggleAll() {
    if (allVisibleSelected) {
      setSelectedFiles((prev) =>
        prev.filter((s) => !visibleFiles.some((f) => f.id === s.id)),
      );
    } else {
      setSelectedFiles((prev) => {
        const toAdd = visibleFiles.filter(
          (f) => !prev.some((s) => s.id === f.id),
        );
        return [...prev, ...toAdd];
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedFiles.length === 0) return;
    const count = selectedFiles.length;
    setSubmitting(true);
    try {
      const token = await getAccessTokenSilently();
      const results = await Promise.allSettled(
        selectedFiles.map((file) =>
          fetch(`${API_BASE_URL}/publish-report`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: stripExt(file.name),
              type,
              reportDate: date,
              clientId,
              sharepointItemId: file.id,
              sharepointDriveId: file.driveId ?? "",
            }),
          }).then(async (resp) => {
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error ?? "Publish failed");
          }),
        ),
      );
      const failures = results
        .map((r, i) =>
          r.status === "rejected"
            ? `${selectedFiles[i].name}: ${(r.reason as Error)?.message}`
            : null,
        )
        .filter(Boolean) as string[];
      if (failures.length > 0) {
        toast.error(`Some reports failed to publish:\n${failures.join("\n")}`);
      } else {
        toast.success(`${count} report${count === 1 ? "" : "s"} published.`);
        router.push("/admin/reports");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 8rem)" }}>
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Button
          type="button"
          onClick={() => router.push("/admin/reports")}
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          Reports
        </Button>
        <span className="text-muted-foreground">/</span>
        <h1 className="font-display text-xl font-medium text-foreground">
          Publish Report
        </h1>
      </div>

      {/* Two-panel layout */}
      <div className="flex min-h-0 flex-1 gap-6">
        {/* File browser */}
        <div className="data-table-shell flex min-h-0 flex-1 flex-col">
          {/* Toolbar */}
          <div className="shrink-0 border-b border-border">
            <div className="flex items-center gap-0.5 overflow-x-auto whitespace-nowrap px-4 pt-3 pb-2 text-sm">
              {browserStack.map((crumb, i) => (
                <Fragment key={i}>
                  {i > 0 && (
                    <span className="mx-1.5 text-muted-foreground">/</span>
                  )}
                  <button
                    type="button"
                    onClick={() => navigateTo(i)}
                    disabled={i === browserStack.length - 1}
                    className={`rounded px-1.5 py-0.5 transition hover:bg-muted disabled:cursor-default ${
                      i === browserStack.length - 1
                        ? "font-semibold text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {crumb.name}
                  </button>
                </Fragment>
              ))}
            </div>
            <div className="px-4 pb-3">
              <div className="relative">
                <svg
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
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
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search files…"
                  className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-sm placeholder-slate-400 outline-none transition focus:border-border focus:ring-2 focus:ring-slate-200"
                />
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {browserLoading ? (
              <SharePointBrowserSkeleton />
            ) : browserError ? (
              <p className="p-6 text-sm text-rose-600">{browserError}</p>
            ) : filteredItems.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                {searchTerm
                  ? `No files matching "${searchTerm}"`
                  : "This folder is empty."}
              </p>
            ) : (
              <table className="w-full caption-bottom text-sm">
                <thead className="data-table-header sticky top-0">
                  <tr className="text-left">
                    <th className="data-table-header-cell w-10">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAll}
                        disabled={visibleFiles.length === 0}
                        className="h-4 w-4 cursor-pointer rounded border-border accent-[#e9e3d5]"
                      />
                    </th>
                    <th className="data-table-header-cell">Name</th>
                    <th className="data-table-header-cell">Size</th>
                    <th className="data-table-header-cell">Modified</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedItems.map((item) => {
                    const isSelected =
                      !item.isFolder &&
                      selectedFiles.some((s) => s.id === item.id);
                    return (
                      <tr
                        key={item.id}
                        onClick={() =>
                          item.isFolder ? navigateInto(item) : toggleFile(item)
                        }
                        className={`data-table-row cursor-pointer ${
                          isSelected ? "bg-muted" : ""
                        }`}
                      >
                        <td
                          className="data-table-cell w-10"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {!item.isFolder && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleFile(item)}
                              className="h-4 w-4 cursor-pointer rounded border-border accent-[#e9e3d5]"
                            />
                          )}
                        </td>
                        <td className="data-table-cell">
                          <div className="flex items-center gap-2.5">
                            <svg
                              className={`h-4 w-4 shrink-0 ${item.isFolder ? "text-amber-500" : isSelected ? "text-emerald-600" : "text-muted-foreground"}`}
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              {item.isFolder ? (
                                <path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                              ) : (
                                <path
                                  fillRule="evenodd"
                                  d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                                  clipRule="evenodd"
                                />
                              )}
                            </svg>
                            <span
                              className={`truncate font-medium ${isSelected ? "text-emerald-800" : item.isFolder ? "text-foreground" : "text-foreground"}`}
                            >
                              {item.name}
                            </span>
                            {item.isFolder && (
                              <svg
                                className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </div>
                        </td>
                        <td className="data-table-cell text-muted-foreground">
                          {!item.isFolder && item.size > 0
                            ? fmtSize(item.size)
                            : "—"}
                        </td>
                        <td className="data-table-cell whitespace-nowrap text-muted-foreground">
                          {item.lastModified
                            ? new Date(item.lastModified).toLocaleDateString()
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex shrink-0 items-center justify-between border-t border-border bg-card/60 px-4 py-2.5">
              <span className="text-xs text-muted-foreground">
                Page {safePage} of {totalPages} &middot; {filteredItems.length}{" "}
                items
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={safePage === 1}
                  className="flex h-7 items-center gap-1 rounded-lg border border-border px-2.5 text-xs text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={safePage === totalPages}
                  className="flex h-7 items-center gap-1 rounded-lg border border-border px-2.5 text-xs text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Form sidebar */}
        <form
          onSubmit={handleSubmit}
          className="flex w-72 shrink-0 flex-col gap-4"
        >
          <div className="flex flex-col rounded-3xl border border-border bg-card/40 p-5 shadow-lg shadow-black/5 backdrop-blur-2xl backdrop-saturate-50">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Selected
              {selectedFiles.length > 0 ? ` (${selectedFiles.length})` : ""}
            </p>
            {selectedFiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Check files on the left to select them.
              </p>
            ) : (
              <ul className="max-h-40 space-y-1.5 overflow-y-auto">
                {selectedFiles.map((f) => (
                  <li key={f.id} className="flex items-center gap-2">
                    <svg
                      className="h-3.5 w-3.5 shrink-0 text-emerald-600"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="flex-1 truncate text-xs text-foreground">
                      {f.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleFile(f)}
                      className="shrink-0 text-muted-foreground transition hover:text-foreground"
                      aria-label="Remove"
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
                  </li>
                ))}
              </ul>
            )}
            {selectedFiles.length > 1 && (
              <p className="mt-3 text-xs text-muted-foreground">
                Titles will be derived from filenames.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-4 rounded-3xl border border-border bg-card/40 p-5 shadow-lg shadow-black/5 backdrop-blur-2xl backdrop-saturate-50">
            <div>
              <label className="field-label mb-2 block">Report Type</label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as ReportType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reportTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="field-label mb-2 block">Report Date</label>
              <input
                className="field-input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="field-label mb-2 block">Client</label>
              <div className="relative">
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => {
                    setClientSearch(e.target.value);
                    setClientDropdownOpen(true);
                    if (!e.target.value) setClientId("");
                  }}
                  onFocus={() => setClientDropdownOpen(true)}
                  onBlur={handleClientBlur}
                  placeholder="Search clients…"
                  required
                  className="field-input pr-7"
                />
                {clientId ? (
                  <button
                    type="button"
                    onMouseDown={() => {
                      setClientId("");
                      setClientSearch("");
                      setClientDropdownOpen(false);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                    aria-label="Clear"
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
                    className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
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
                  <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
                    {filteredClients.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">
                        No clients found
                      </p>
                    ) : (
                      filteredClients.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onMouseDown={() => selectClient(c.id, c.name)}
                          className={`w-full px-3 py-2 text-left text-sm transition hover:bg-muted ${clientId === c.id ? "font-semibold text-foreground" : "text-foreground"}`}
                        >
                          {c.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {/* hidden required sentinel */}
              <input
                type="text"
                required
                readOnly
                tabIndex={-1}
                className="sr-only"
                value={clientId}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.push("/admin/reports")}
              className="flex-1 rounded-full border border-border px-4 py-2.5 text-sm text-foreground transition hover:border-border hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || selectedFiles.length === 0}
              className="flex-1 rounded-full bg-secondary px-4 py-2.5 text-sm text-white transition hover:bg-accent disabled:cursor-not-allowed disabled:bg-muted"
            >
              {submitting
                ? "Publishing…"
                : selectedFiles.length > 1
                  ? `Publish ${selectedFiles.length}`
                  : "Publish"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
