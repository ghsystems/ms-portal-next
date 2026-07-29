import { useCallback, useEffect, useMemo, useState } from "react";
import { useResizableCols } from "@/hooks/useResizableCols";
import { Pencil, Plus, Trash2 } from "lucide-react";

const ME_COLS = [
  { id: "title" as const, label: "Title", width: 240, minWidth: 150 },
  { id: "type" as const, label: "Type", width: 130, minWidth: 80 },
  { id: "window" as const, label: "Window", width: 280, minWidth: 180 },
  { id: "clients" as const, label: "Clients", width: 200, minWidth: 120 },
  { id: "status" as const, label: "Status", width: 120, minWidth: 80 },
  { id: "actions" as const, label: "", width: 210, minWidth: 190 },
];
import Link from "next/link";
import { useAuth0 } from "@auth0/auth0-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  bannerTypeConfig,
  type BannerType,
} from "@/components/portal/banner-config";
import { formatDateTime } from "@/components/portal/portal-utils";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

type Client = { id: string; name: string };

type MaintenanceEvent = {
  id: string;
  title: string;
  message: string;
  type: BannerType;
  starts_at: string;
  ends_at: string;
  all_clients: boolean;
  maintenance_event_clients: { client_id: string }[];
};

function MaintenanceEventsTableSkeleton() {
  return (
    <div
      className="space-y-3 p-8"
      role="status"
      aria-label="Loading maintenance banners"
    >
      {[...Array(4)].map((_, index) => (
        <div key={index} className="flex items-center gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
      ))}
      <span className="sr-only">Loading maintenance banners</span>
    </div>
  );
}

function status(event: { starts_at: string; ends_at: string }) {
  const now = Date.now();
  if (now < new Date(event.starts_at).getTime()) return "Upcoming";
  if (now <= new Date(event.ends_at).getTime()) return "Active";
  return "Ended";
}

const statusStyle: Record<string, string> = {
  Upcoming: "bg-sky-100 text-sky-900 ring-sky-200",
  Active: "bg-amber-100 text-amber-900 ring-amber-200",
  Ended: "bg-muted text-muted-foreground ring-slate-200",
};

export default function MaintenanceEventsView() {
  const { startResize, gridTemplate, totalWidth } = useResizableCols(ME_COLS);
  const { getAccessTokenSilently } = useAuth0();
  const [events, setEvents] = useState<MaintenanceEvent[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const [deleteTarget, setDeleteTarget] = useState<MaintenanceEvent | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  const clientNameById = useMemo(
    () => new Map(clients.map((c) => [c.id, c.name])),
    [clients],
  );

  const loadData = useCallback(async () => {
    try {
      const token = await getAccessTokenSilently();

      const [{ events }, { clients }] = await Promise.all([
        apiFetch<{ events: MaintenanceEvent[] }>("/maintenance-events", token),
        apiFetch<{ clients: { id: string; name: string }[] }>("/list-clients", token),
      ]);

      setEvents(events);
      setClients(clients);
    } catch {
      // network error - leave lists empty
    } finally {
      setLoading(false);
    }
  }, [getAccessTokenSilently]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleting(true);
    try {
      const token = await getAccessTokenSilently();
      // The endpoint writes its own audit entry server-side.
      await apiFetch(`/maintenance-events?id=${encodeURIComponent(target.id)}`, token, {
        method: "DELETE",
      });
      toast.success(`"${target.title}" deleted.`);
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl font-light text-foreground tracking-normal">
            Maintenance &amp; Banners
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Schedule a banner - a maintenance window or a general notice - for
            some or all clients. It shows in the portal from start to end time
            and can be dismissed per session.
          </p>
        </div>
        <Link href="/admin/maintenance-events/new" className={buttonVariants()}>
          <Plus data-icon="inline-start" />
          New Banner
        </Link>
      </div>

      <div className="data-table-shell mt-6">
        {loading ? (
          <MaintenanceEventsTableSkeleton />
        ) : events.length === 0 ? (
          <div className="data-table-empty">
            <p className="text-sm text-muted-foreground">
              No banners yet. Click "New Banner" to schedule one.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: `${totalWidth}px` }}>
              <div
                className="data-table-header grid"
                style={{ gridTemplateColumns: gridTemplate }}
              >
                {ME_COLS.map((col, i) => (
                  <div
                    key={col.id}
                    className="data-table-header-cell relative select-none"
                  >
                    {col.label}
                    {i < ME_COLS.length - 1 && (
                      <div
                        className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize hover:bg-muted"
                        onMouseDown={(e) => startResize(col.id, e)}
                      />
                    )}
                  </div>
                ))}
              </div>
              {events.map((event) => {
                const s = status(event);
                const typeStyle = bannerTypeConfig[event.type];
                const clientNames = event.all_clients
                  ? "All Clients"
                  : event.maintenance_event_clients
                      .map((c) => clientNameById.get(c.client_id) ?? "-")
                      .join(", ");
                return (
                  <div
                    key={event.id}
                    className="data-table-row grid"
                    style={{ gridTemplateColumns: gridTemplate }}
                  >
                    <div className="data-table-cell overflow-hidden text-sm text-foreground">
                      {event.title}
                    </div>
                    <div className="data-table-cell">
                      <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
                        <span
                          className={cn(
                            "h-2 w-2 shrink-0 rounded-full",
                            typeStyle.dot,
                          )}
                        />
                        {typeStyle.label}
                      </span>
                    </div>
                    <div className="data-table-cell overflow-hidden text-sm text-foreground">
                      {formatDateTime(event.starts_at)} -{" "}
                      {formatDateTime(event.ends_at)}
                    </div>
                    <div
                      className="data-table-cell overflow-hidden text-sm text-foreground"
                      title={clientNames}
                    >
                      <span className="block truncate">
                        {clientNames || "-"}
                      </span>
                    </div>
                    <div className="data-table-cell">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ring-1",
                          statusStyle[s],
                        )}
                      >
                        {s}
                      </span>
                    </div>
                    <div className="data-table-cell flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/maintenance-events/${event.id}/edit`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                          className: "whitespace-nowrap",
                        })}
                      >
                        <Pencil data-icon="inline-start" />
                        Edit
                      </Link>
                      <Button
                        type="button"
                        onClick={() => setDeleteTarget(event)}
                        variant="destructive"
                        size="sm"
                        className="whitespace-nowrap"
                      >
                        <Trash2 data-icon="inline-start" />
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Banner</DialogTitle>
            <DialogDescription>
              This will immediately remove "{deleteTarget?.title}" and hide its
              banner for all affected clients.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <DialogClose className="rounded-full border border-border px-5 py-2.5 text-sm text-foreground transition hover:border-border hover:bg-muted">
              Cancel
            </DialogClose>
            <Button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              variant="destructive"
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
