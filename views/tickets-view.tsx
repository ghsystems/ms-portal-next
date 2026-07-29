import {
  useDeferredValue,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  ticketStatuses,
  type PortalTicket,
  type Priority,
  type TicketStatus,
} from "@/components/portal/portal-data";
import { usePortal } from "@/components/portal/use-portal";
import { fetchTicketDetail, type TicketSummary } from "@/lib/tickets";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PortalIcon,
  PriorityBadge,
  StatusBadge,
} from "@/components/portal/portal-ui";
import { formatDateTime, timeAgo } from "@/components/portal/portal-utils";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const COL_DEFS = [
  { id: "id" as const, label: "ID", width: 96, minWidth: 60 },
  { id: "subject" as const, label: "Subject", width: 280, minWidth: 100 },
  { id: "type" as const, label: "Type", width: 160, minWidth: 80 },
  { id: "requester" as const, label: "Requester", width: 160, minWidth: 80 },
  { id: "status" as const, label: "Status", width: 120, minWidth: 80 },
  { id: "priority" as const, label: "Priority", width: 116, minWidth: 80 },
  { id: "updated" as const, label: "Updated", width: 140, minWidth: 80 },
];
type ColId = (typeof COL_DEFS)[number]["id"];

type FilterValue = "All";
type TypeFilter = "All" | "Incident" | "Request";
type SortMode =
  | "updated-desc"
  | "updated-asc"
  | "priority-desc"
  | "priority-asc";

const priorityRank: Record<Priority, number> = {
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4,
};

// ServiceNow descriptions submitted by the portal are prefixed with
// "Request Type:", "Requester:", "Impact: ... | Urgency: ..." metadata lines,
// separated from the actual text by a blank line. Strip that header so the
// description shown here doesn't repeat fields already shown elsewhere.
function cleanDescription(raw: string) {
  const blankLineIndex = raw.indexOf("\n\n");
  if (blankLineIndex === -1) return raw;
  const header = raw.slice(0, blankLineIndex);
  const isMetadataHeader =
    /request type:|requester:|impact:|p1 critical|submitted through/i.test(
      header,
    );
  return isMetadataHeader ? raw.slice(blankLineIndex + 2).trim() : raw;
}

function sortTickets(tickets: TicketSummary[], mode: SortMode) {
  return tickets.slice().sort((left, right) => {
    if (mode === "updated-desc") {
      return right.updatedAt.localeCompare(left.updatedAt);
    }

    if (mode === "updated-asc") {
      return left.updatedAt.localeCompare(right.updatedAt);
    }

    if (mode === "priority-desc") {
      return priorityRank[right.priority] - priorityRank[left.priority];
    }

    return priorityRank[left.priority] - priorityRank[right.priority];
  });
}

function TicketsTableSkeleton() {
  return (
    <div className="space-y-3 p-5" role="status" aria-label="Loading tickets">
      {[...Array(6)].map((_, index) => (
        <div
          key={index}
          className="rounded-[20px] border border-border bg-card/60 px-4 py-4"
        >
          <div className="hidden items-center gap-4 xl:grid xl:grid-cols-[96px_280px_160px_160px_120px_116px_140px]">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-52" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <div className="space-y-3 xl:hidden">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-7 w-20 rounded-full" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-7 w-20 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        </div>
      ))}
      <span className="sr-only">Loading tickets</span>
    </div>
  );
}

function TicketActivitySkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="Loading ticket updates">
      {[...Array(3)].map((_, index) => (
        <div
          key={index}
          className="rounded-[24px] border border-border bg-card/80 p-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading ticket updates</span>
    </div>
  );
}

export default function TicketsView() {
  const { ticketStats, tickets, ticketsLoading, ticketsError } = usePortal();
  const { getAccessTokenSilently } = useAuth0();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | FilterValue>(
    "All",
  );
  const [priorityFilter, setPriorityFilter] = useState<Priority | FilterValue>(
    "All",
  );
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("All");
  const [sortMode, setSortMode] = useState<SortMode>("updated-desc");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketDetail, setTicketDetail] = useState<PortalTicket | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [colWidths, setColWidths] = useState<Record<ColId, number>>(
    () =>
      Object.fromEntries(COL_DEFS.map((c) => [c.id, c.width])) as Record<
        ColId,
        number
      >,
  );
  const [hiddenCols, setHiddenCols] = useState<Set<ColId>>(new Set());
  const colWidthsRef = useRef(colWidths);
  useEffect(() => {
    colWidthsRef.current = colWidths;
  }, [colWidths]);

  const startResize = useCallback((id: ColId, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = colWidthsRef.current[id];
    const minW = COL_DEFS.find((c) => c.id === id)!.minWidth;
    const onMove = (ev: MouseEvent) =>
      setColWidths((prev) => ({
        ...prev,
        [id]: Math.max(minW, startW + ev.clientX - startX),
      }));
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  const toggleCol = (id: ColId) =>
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const visibleDefs = COL_DEFS.filter((c) => !hiddenCols.has(c.id));
  const gridTemplate = visibleDefs.map((c) => `${colWidths[c.id]}px`).join(" ");

  const deferredSearch = useDeferredValue(search);

  const filteredTickets = sortTickets(
    tickets.filter((ticket) => {
      const searchValue = deferredSearch.trim().toLowerCase();
      const matchesSearch =
        !searchValue ||
        ticket.id.toLowerCase().includes(searchValue) ||
        ticket.subject.toLowerCase().includes(searchValue);
      const matchesStatus =
        statusFilter === "All" ? true : ticket.status === statusFilter;
      const matchesPriority =
        priorityFilter === "All" ? true : ticket.priority === priorityFilter;
      const matchesType =
        typeFilter === "All"
          ? true
          : typeFilter === "Incident"
            ? ticket.requestType === "Incident"
            : ticket.requestType !== "Incident";

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesType
      );
    }),
    sortMode,
  );

  const selectedTicket =
    tickets.find((ticket) => ticket.id === selectedTicketId) ?? null;
  const visibleSelectedTicket =
    selectedTicket &&
    filteredTickets.some((ticket) => ticket.id === selectedTicket.id)
      ? selectedTicket
      : null;

  const currentSelectedId = visibleSelectedTicket?.id ?? null;
  const [prevSelectedId, setPrevSelectedId] = useState(currentSelectedId);
  if (currentSelectedId !== prevSelectedId) {
    setPrevSelectedId(currentSelectedId);
    if (!currentSelectedId) {
      setTicketDetail(null);
      setDetailError(null);
    }
  }

  useEffect(() => {
    if (!visibleSelectedTicket) return;

    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);

    (async () => {
      try {
        const token = await getAccessTokenSilently();
        const detail = await fetchTicketDetail(
          token,
          visibleSelectedTicket.sysId,
        );
        if (!cancelled) setTicketDetail(detail);
      } catch (err) {
        if (!cancelled) {
          setDetailError(
            err instanceof Error
              ? err.message
              : "Failed to load ticket details.",
          );
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visibleSelectedTicket, getAccessTokenSilently]);

  const openTicket = (ticket: TicketSummary) => {
    setSelectedTicketId(ticket.id);
  };

  const closeTicket = () => {
    setSelectedTicketId(null);
  };

  return (
    <div className="space-y-6">
      <section className="glass-panel px-6 py-6 lg:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="mt-2 font-display text-4xl font-light text-foreground">
              All Tickets
            </h2>
            <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
              Search, filter, and open a ticket to see live status, priority,
              and updates.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <article className="rounded-[24px] border border-border bg-card px-4 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                Open
              </p>
              {ticketsLoading ? (
                <Skeleton className="mt-3 h-9 w-12" />
              ) : (
                <p className="mt-2 text-3xl font-semibold text-foreground">
                  {ticketStats.open}
                </p>
              )}
            </article>
            <article className="rounded-[24px] border border-border bg-card px-4 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                In progress
              </p>
              {ticketsLoading ? (
                <Skeleton className="mt-3 h-9 w-12" />
              ) : (
                <p className="mt-2 text-3xl font-semibold text-foreground">
                  {ticketStats.inProgress}
                </p>
              )}
            </article>
            <article className="rounded-[24px] border border-border bg-card px-4 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                Resolved
              </p>
              {ticketsLoading ? (
                <Skeleton className="mt-3 h-9 w-12" />
              ) : (
                <p className="mt-2 text-3xl font-semibold text-foreground">
                  {ticketStats.resolved}
                </p>
              )}
            </article>
          </div>
        </div>

        <div className="mt-6 grid gap-4 rounded-[28px] border border-border bg-card/80 p-5 md:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-2 xl:col-span-2">
            <span className="field-label">Search</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="field-input"
              placeholder="Search by ticket ID or subject"
            />
          </label>
          <label className="space-y-2">
            <span className="field-label">Status</span>
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as TicketStatus | FilterValue)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["All", ...ticketStatuses].map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="space-y-2">
            <span className="field-label">Priority</span>
            <Select
              value={priorityFilter}
              onValueChange={(value) =>
                setPriorityFilter(value as Priority | FilterValue)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["All", "Critical", "High", "Medium", "Low"].map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="space-y-2">
            <span className="field-label">Type</span>
            <Select
              value={typeFilter}
              onValueChange={(value) => setTypeFilter(value as TypeFilter)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                <SelectItem value="Incident">Incidents</SelectItem>
                <SelectItem value="Request">Service / Change Requests</SelectItem>
              </SelectContent>
            </Select>
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-[24px] bg-muted px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-semibold text-foreground">
              {filteredTickets.length}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-foreground">{tickets.length}</span>{" "}
            tickets
          </p>
          <div className="flex items-center gap-3">
            <details className="relative">
              <summary className="cursor-pointer list-none rounded-full border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground hover:border-border hover:bg-muted">
                Columns
              </summary>
              <div className="absolute right-0 z-10 mt-1 min-w-36 rounded-2xl border border-border bg-card p-2 shadow-lg">
                {COL_DEFS.map((col) => {
                  const checked = !hiddenCols.has(col.id);
                  return (
                    <label
                      key={col.id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-foreground hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCol(col.id)}
                        className="sr-only"
                      />
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                          checked
                            ? "border-border bg-secondary"
                            : "border-border bg-card",
                        )}
                      >
                        {checked && (
                          <PortalIcon name="check" className="h-3 w-3 text-white" />
                        )}
                      </span>
                      {col.label}
                    </label>
                  );
                })}
              </div>
            </details>
            <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
              Sort by
              <Select
                value={sortMode}
                onValueChange={(value) => setSortMode(value as SortMode)}
                items={[
                  { value: "updated-desc", label: "Updated: newest first" },
                  { value: "updated-asc", label: "Updated: oldest first" },
                  { value: "priority-desc", label: "Priority: highest first" },
                  { value: "priority-asc", label: "Priority: lowest first" },
                ]}
              >
                <SelectTrigger className="w-56 rounded-full border-border px-3 py-2 text-sm text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="updated-desc">
                    Updated: newest first
                  </SelectItem>
                  <SelectItem value="updated-asc">
                    Updated: oldest first
                  </SelectItem>
                  <SelectItem value="priority-desc">
                    Priority: highest first
                  </SelectItem>
                  <SelectItem value="priority-asc">
                    Priority: lowest first
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="data-table-shell mt-6">
          <div className="overflow-x-auto">
            <div
              className="data-table-header hidden xl:grid"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              {visibleDefs.map((col, i) => (
                <div
                  key={col.id}
                  className="data-table-header-cell relative flex items-center overflow-hidden"
                >
                  {col.label}
                  {i < visibleDefs.length - 1 && (
                    <div
                      className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize select-none hover:bg-muted"
                      onMouseDown={(e) => startResize(col.id, e)}
                    />
                  )}
                </div>
              ))}
            </div>

            <div>
              {ticketsLoading ? (
                <TicketsTableSkeleton />
              ) : ticketsError ? (
                <div className="data-table-empty text-rose-700">
                  {ticketsError}
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="data-table-empty">
                  <p className="font-display text-2xl tracking-normal text-foreground">
                    No tickets match the current filters.
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Try widening the filters or clearing the search term.
                  </p>
                </div>
              ) : (
                filteredTickets.map((ticket) => (
                  <article
                    key={ticket.id}
                    onClick={() => openTicket(ticket)}
                    className="data-table-row cursor-pointer px-5 py-4"
                  >
                    <div
                      className="-mx-5 hidden items-center xl:grid"
                      style={{ gridTemplateColumns: gridTemplate }}
                    >
                      {!hiddenCols.has("id") && (
                        <div className="min-w-0 overflow-hidden px-4">
                          <p className="text-xs font-semibold text-muted-foreground">
                            {ticket.id}
                          </p>
                        </div>
                      )}
                      {!hiddenCols.has("subject") && (
                        <div className="min-w-0 overflow-hidden px-4">
                          <p className="truncate font-semibold text-foreground">
                            {ticket.subject}
                          </p>
                        </div>
                      )}
                      {!hiddenCols.has("type") && (
                        <div className="min-w-0 overflow-hidden px-4">
                          <p className="truncate text-sm font-medium text-foreground">
                            {ticket.requestType}
                          </p>
                        </div>
                      )}
                      {!hiddenCols.has("requester") && (
                        <div className="min-w-0 overflow-hidden px-4">
                          <p className="truncate text-sm text-muted-foreground">
                            {ticket.requester}
                          </p>
                        </div>
                      )}
                      {!hiddenCols.has("status") && (
                        <div className="min-w-0 px-4">
                          <StatusBadge value={ticket.status} />
                        </div>
                      )}
                      {!hiddenCols.has("priority") && (
                        <div className="min-w-0 px-4">
                          <PriorityBadge value={ticket.priority} />
                        </div>
                      )}
                      {!hiddenCols.has("updated") && (
                        <div className="min-w-0 overflow-hidden px-4">
                          <p className="text-sm font-medium text-foreground">
                            {formatDateTime(ticket.updatedAt)}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {timeAgo(ticket.updatedAt)}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 xl:hidden">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">
                            {ticket.subject}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            {ticket.id}
                          </p>
                        </div>
                        <PriorityBadge value={ticket.priority} />
                      </div>
                      <div className="flex items-center justify-between">
                        <StatusBadge value={ticket.status} />
                        <p className="text-sm text-muted-foreground">
                          {timeAgo(ticket.updatedAt)}
                        </p>
                      </div>
                      <p className="text-xs font-semibold text-muted-foreground">
                        Tap to open details
                      </p>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <Dialog
        open={Boolean(visibleSelectedTicket)}
        onOpenChange={(open) => {
          if (!open) {
            closeTicket();
          }
        }}
      >
        {visibleSelectedTicket ? (
          <DialogContent>
            <DialogHeader className="pr-20">
              <DialogTitle className="font-display text-3xl tracking-normal text-foreground">
                {visibleSelectedTicket.id}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Created {formatDateTime(visibleSelectedTicket.createdAt)} -
                Updated {formatDateTime(visibleSelectedTicket.updatedAt)}
              </DialogDescription>
            </DialogHeader>

            <DialogClose
              className="absolute right-6 top-6 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:border-border hover:bg-muted"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </DialogClose>

            <div className="mt-5 space-y-4 pr-1">
              <div className="space-y-2">
                <p className="field-label">Subject</p>
                <p className="text-sm font-medium text-foreground">
                  {visibleSelectedTicket.subject}
                </p>
              </div>
              <div className="space-y-2">
                <p className="field-label">Description</p>
                <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                  {cleanDescription(visibleSelectedTicket.description) ||
                    "No description provided."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="field-label">Request type</p>
                  <p className="text-sm font-medium text-foreground">
                    {visibleSelectedTicket.requestType}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="field-label">Requester</p>
                  <p className="text-sm font-medium text-foreground">
                    {visibleSelectedTicket.requester}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="field-label">Impact</p>
                  <p className="text-sm font-medium text-foreground">
                    {visibleSelectedTicket.impact}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="field-label">Urgency</p>
                  <p className="text-sm font-medium text-foreground">
                    {visibleSelectedTicket.urgency}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="field-label">Priority</p>
                  <PriorityBadge value={visibleSelectedTicket.priority} />
                </div>
                <div className="space-y-2">
                  <p className="field-label">Status</p>
                  <StatusBadge value={visibleSelectedTicket.status} />
                </div>
              </div>

              <div className="space-y-3">
                <p className="field-label">Activity log</p>
                {detailLoading ? (
                  <TicketActivitySkeleton />
                ) : detailError ? (
                  <p className="text-sm text-rose-700">{detailError}</p>
                ) : !ticketDetail || ticketDetail.activityLog.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No updates yet.</p>
                ) : (
                  ticketDetail.activityLog.map((entry) => (
                    <article
                      key={entry.id}
                      className="rounded-[24px] border border-border bg-card/80 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {entry.actor}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            {entry.message}
                          </p>
                        </div>
                        <p className="whitespace-nowrap text-sm text-muted-foreground">
                          {timeAgo(entry.timestamp)}
                        </p>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
