import { useCallback, useEffect, useState } from "react";
import { useResizableCols } from "@/hooks/useResizableCols";
import { useAuth0 } from "@auth0/auth0-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_SIZE = 25;

const AUDIT_COLS = [
  { id: "ts" as const,      label: "Timestamp", width: 180, minWidth: 120 },
  { id: "admin" as const,   label: "Admin",     width: 220, minWidth: 120 },
  { id: "action" as const,  label: "Action",    width: 180, minWidth: 100 },
  { id: "target" as const,  label: "Target",    width: 180, minWidth: 100 },
  { id: "details" as const, label: "Details",   width: 280, minWidth: 150 },
  { id: "outcome" as const, label: "Outcome",   width: 120, minWidth:  80 },
];

const ACTION_LABELS: Record<string, string> = {
  invite_user: "Invite User",
  deactivate_user: "Deactivate User",
  reactivate_user: "Reactivate User",
  unlock_user: "Unlock User",
  set_p1_authorization: "Set P1 Authorization",
  add_ms_team_member: "Add MS Team Member",
  remove_ms_team_member: "Remove MS Team Member",
  create_maintenance_event: "Create Banner",
  update_maintenance_event: "Update Banner",
  delete_maintenance_event: "Delete Banner",
  update_support_contacts: "Update Support Contacts",
};

type AuditLog = {
  id: string;
  admin_user_id: string;
  admin_email: string | null;
  action_type: string;
  target_type: string;
  target_id: string | null;
  target_label: string | null;
  outcome: string;
  details: string | null;
  created_at: string;
};

function AuditLogTableSkeleton() {
  return (
    <div className="space-y-3 p-8" role="status" aria-label="Loading audit log">
      {[...Array(6)].map((_, index) => (
        <div key={index} className="grid gap-4 md:grid-cols-[180px_1fr_140px]">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
      ))}
      <span className="sr-only">Loading audit log</span>
    </div>
  );
}

export default function AuditLogView() {
  const { startResize, gridTemplate, totalWidth } = useResizableCols(AUDIT_COLS);
  const { getAccessTokenSilently } = useAuth0();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [actionType, setActionType] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessTokenSilently();

      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      if (actionType) params.set("actionType", actionType);
      if (adminEmail) params.set("adminEmail", adminEmail);

      const { logs: data, total: count } = await apiFetch<{
        logs: AuditLog[];
        total: number;
      }>(`/audit-logs?${params}`, token);
      setLogs(data);
      setTotal(count);
    } catch {
      // leave empty on error
    } finally {
      setLoading(false);
    }
  }, [getAccessTokenSilently, dateFrom, dateTo, actionType, adminEmail, page]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Jump back to the first page whenever a filter changes, so you're never
  // stranded on a page number that no longer exists for the new result set.
  useEffect(() => {
    setPage(0);
  }, [dateFrom, dateTo, actionType, adminEmail]);

  function formatTs(ts: string) {
    return new Date(ts).toLocaleString("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  return (
    <>
      <div>
        <h1 className="font-display text-4xl font-light text-foreground tracking-normal">
          Audit Log
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Record of admin actions.
        </p>
      </div>

      <div className="mt-6 rounded-3xl bg-card/40 p-4 shadow-lg shadow-black/5 backdrop-blur-2xl backdrop-saturate-50">
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="field-label mb-1 block">From</label>
            <input
              type="date"
              className="field-input"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label mb-1 block">To</label>
            <input
              type="date"
              className="field-input"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label mb-1 block">Action</label>
            <Select
              value={actionType}
              onValueChange={(value) => setActionType((value ?? "") as string)}
              items={[
                { value: "", label: "All Actions" },
                ...Object.entries(ACTION_LABELS).map(([value, label]) => ({
                  value,
                  label,
                })),
              ]}
            >
              <SelectTrigger className="h-[50px] w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Actions</SelectItem>
                {Object.entries(ACTION_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="field-label mb-1 block">Admin</label>
            <input
              type="text"
              className="field-input"
              placeholder="Filter by email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="data-table-shell mt-4">
        {loading ? (
          <AuditLogTableSkeleton />
        ) : logs.length === 0 ? (
          <div className="data-table-empty">
            <p className="text-sm text-muted-foreground">No audit log entries found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: `${totalWidth}px` }}>
              <div
                className="data-table-header grid"
                style={{ gridTemplateColumns: gridTemplate }}
              >
                {AUDIT_COLS.map((col, i) => (
                  <div key={col.id} className="data-table-header-cell relative select-none">
                    {col.label}
                    {i < AUDIT_COLS.length - 1 && (
                      <div
                        className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize hover:bg-muted"
                        onMouseDown={(e) => startResize(col.id, e)}
                      />
                    )}
                  </div>
                ))}
              </div>
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="data-table-row grid"
                  style={{ gridTemplateColumns: gridTemplate }}
                >
                  <div className="data-table-cell overflow-hidden font-mono text-xs text-muted-foreground">{formatTs(log.created_at)}</div>
                  <div className="data-table-cell overflow-hidden text-sm text-foreground">{log.admin_email ?? log.admin_user_id}</div>
                  <div className="data-table-cell overflow-hidden text-sm font-medium text-foreground">{ACTION_LABELS[log.action_type] ?? log.action_type}</div>
                  <div className="data-table-cell overflow-hidden text-sm text-muted-foreground">{log.target_label ?? log.target_id ?? "-"}</div>
                  <div className="data-table-cell overflow-hidden text-xs text-muted-foreground">{log.details ?? "-"}</div>
                  <div className="data-table-cell">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1",
                        log.outcome === "success"
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                          : "bg-rose-50 text-rose-700 ring-rose-200",
                      )}
                    >
                      {log.outcome}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                variant="outline"
                size="sm"
                className="text-muted-foreground"
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page + 1} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
              </span>
              <Button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={(page + 1) * PAGE_SIZE >= total}
                variant="outline"
                size="sm"
                className="text-muted-foreground"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
