import { useEffect, useState, useCallback } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { reportTypes, type ReportType } from "@/components/portal/portal-data";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PortalIcon } from "@/components/portal/portal-ui";
import { formatDate } from "@/components/portal/portal-utils";
import { API_BASE_URL } from "@/lib/api";

type Report = {
  id: string;
  title: string;
  type: ReportType;
  report_date: string;
};

type PreviewState = { id: string; title: string; blobUrl: string };

const TYPE_LABEL: Record<ReportType, string> = {
  "Monthly Managed Services Report": "Monthly",
  "Major Incident Report": "MIR",
  "Annual SOC 2 Report": "SOC 2",
  "Invoice": "Invoice",
};

function ReportsListSkeleton() {
  return (
    <div className="space-y-3 p-8" role="status" aria-label="Loading reports">
      {[...Array(4)].map((_, index) => (
        <div key={index} className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-32" />
          </div>
          <div className="flex shrink-0 gap-2">
            <Skeleton className="h-10 w-24 rounded-full" />
            <Skeleton className="h-10 w-28 rounded-full" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading reports</span>
    </div>
  );
}

export default function ReportsView() {
  const { getAccessTokenSilently } = useAuth0();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"All" | ReportType>("All");
  const [downloading, setDownloading] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);

  const loadReports = useCallback(async () => {
    try {
      const token = await getAccessTokenSilently();
      const resp = await fetch(`${API_BASE_URL}/list-reports`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? "Failed to load reports");
      setReports(data.reports ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, [getAccessTokenSilently]);

  useEffect(() => { loadReports(); }, [loadReports]);

  async function fetchBlob(reportId: string) {
    const token = await getAccessTokenSilently();
    const resp = await fetch(`${API_BASE_URL}/download-report?id=${reportId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new Error(data.error ?? "Failed to fetch file");
    }
    return resp.blob();
  }

  async function handlePreview(report: Report) {
    setPreviewing(report.id);
    try {
      const blob = await fetchBlob(report.id);
      setPreview({ id: report.id, title: report.title, blobUrl: URL.createObjectURL(blob) });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewing(null);
    }
  }

  async function handleDownload(report: Report) {
    setDownloading(report.id);
    try {
      const blob = await fetchBlob(report.id);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = report.title;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(null);
    }
  }

  function downloadFromPreview() {
    if (!preview) return;
    const a = document.createElement("a");
    a.href = preview.blobUrl;
    a.download = preview.title;
    a.click();
  }

  function closePreview() {
    if (preview) URL.revokeObjectURL(preview.blobUrl);
    setPreview(null);
  }

  const visible =
    filter === "All" ? reports : reports.filter((r) => r.type === filter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-light text-foreground">Reports</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Download reports prepared by GlassHouse for your organisation.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["All", ...reportTypes] as Array<"All" | ReportType>).map((t) => (
          <Button
            key={t}
            type="button"
            onClick={() => setFilter(t)}
            variant={filter === t ? "default" : "outline"}
          >
            {t}
          </Button>
        ))}
      </div>

      <div className="glass-panel divide-y divide-slate-100 overflow-hidden">
        {loading ? (
          <ReportsListSkeleton />
        ) : error ? (
          <div className="p-8 text-center text-sm text-rose-600">{error}</div>
        ) : visible.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <PortalIcon name="reports" className="h-7 w-7" />
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              {filter === "All" ? "No reports available yet." : `No ${filter}s available yet.`}
            </p>
          </div>
        ) : (
          visible.map((report) => (
            <div
              key={report.id}
              className="flex items-center justify-between gap-4 px-6 py-4"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{report.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  <span className="mr-3 inline-block rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                    {TYPE_LABEL[report.type]}
                  </span>
                  {formatDate(report.report_date)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  onClick={() => handlePreview(report)}
                  disabled={previewing === report.id || downloading === report.id}
                  variant="outline"
                >
                  <PortalIcon name="eye" className="h-4 w-4" data-icon="inline-start" />
                  {previewing === report.id ? "Loading..." : "Preview"}
                </Button>
                <Button
                  type="button"
                  onClick={() => handleDownload(report)}
                  disabled={downloading === report.id || previewing === report.id}
                >
                  <PortalIcon name="download" className="h-4 w-4" data-icon="inline-start" />
                  {downloading === report.id ? "Preparing..." : "Download"}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!preview} onOpenChange={(open) => { if (!open) closePreview(); }}>
        <DialogContent className="max-w-5xl space-y-4 p-6">
          <DialogHeader className="text-left">
            <DialogTitle className="truncate">{preview?.title}</DialogTitle>
          </DialogHeader>
          <iframe
            src={preview?.blobUrl}
            className="h-[65vh] w-full rounded-2xl border border-border bg-muted"
            title={preview?.title}
          />
          <DialogFooter className="justify-end">
            <DialogClose className="rounded-full border border-border px-5 py-2.5 text-sm text-foreground transition hover:border-border hover:bg-muted">
              Close
            </DialogClose>
            <Button
              type="button"
              onClick={downloadFromPreview}
            >
              <PortalIcon name="download" className="h-4 w-4" data-icon="inline-start" />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
