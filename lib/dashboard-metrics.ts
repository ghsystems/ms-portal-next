import type {
  Priority,
  RequestType,
  TicketStatus,
} from "@/components/portal/portal-data";

export type MetricTicket = {
  status: TicketStatus;
  priority: Priority;
  requestType: RequestType;
  createdAt: string;
  updatedAt: string;
};

export const priorityOrder: Priority[] = ["Critical", "High", "Medium", "Low"];
export const statusOrder: TicketStatus[] = ["Open", "In Progress", "Resolved"];
export const requestTypeOrder: RequestType[] = [
  "Incident",
  "Change Request",
  "Service Request",
];

const isActive = (t: { status: TicketStatus }) => t.status !== "Resolved";
const DAY_MS = 24 * 60 * 60 * 1000;

export type Segment = { label: string; count: number };
export type ResolutionTrendBucket = {
  start: Date;
  avgHours: number | null;
  count: number;
};
export type PriorityTrendBucket = {
  start: Date;
  counts: Record<Priority, number>;
  total: number;
};

/** Priority mix of open + in-progress tickets, in severity order. */
export function priorityBreakdown(tickets: MetricTicket[]): Segment[] {
  const active = tickets.filter(isActive);
  return priorityOrder.map((label) => ({
    label,
    count: active.filter((t) => t.priority === label).length,
  }));
}

/** Status mix across all tickets. */
export function statusBreakdown(tickets: MetricTicket[]): Segment[] {
  return statusOrder.map((label) => ({
    label,
    count: tickets.filter((t) => t.status === label).length,
  }));
}

/** Request-type mix across all tickets. */
export function requestTypeBreakdown(tickets: MetricTicket[]): Segment[] {
  return requestTypeOrder.map((label) => ({
    label,
    count: tickets.filter((t) => t.requestType === label).length,
  }));
}

/** Open/in-progress tickets bucketed by age. */
export function agingBuckets(
  tickets: MetricTicket[],
  now = Date.now(),
): Segment[] {
  const ages = tickets
    .filter(isActive)
    .map((t) => (now - new Date(t.createdAt).getTime()) / DAY_MS);
  return [
    { label: "0-7d", count: ages.filter((a) => a < 7).length },
    { label: "7-30d", count: ages.filter((a) => a >= 7 && a < 30).length },
    { label: "30d+", count: ages.filter((a) => a >= 30).length },
  ];
}

/** Ticket counts bucketed into the last `weeks` 7-day windows, oldest first. */
export function weeklyCounts(
  dates: string[],
  weeks = 8,
  now = Date.now(),
): { start: Date; count: number }[] {
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const end = now - (weeks - 1 - i) * 7 * DAY_MS;
    return { start: end - 7 * DAY_MS, end, count: 0 };
  });
  // Last bucket includes "now" so a just-created ticket lands in it.
  buckets[buckets.length - 1].end = now + DAY_MS;

  for (const d of dates) {
    const t = new Date(d).getTime();
    if (Number.isNaN(t)) continue;
    const b = buckets.find((bucket) => t >= bucket.start && t < bucket.end);
    if (b) b.count += 1;
  }
  return buckets.map((b) => ({ start: new Date(b.start), count: b.count }));
}

/** Ticket counts per calendar day over the last `days`, oldest first. */
export function dailyCounts(
  dates: string[],
  days = 14,
  now = Date.now(),
): { start: Date; count: number }[] {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const buckets = Array.from({ length: days }, (_, i) => {
    const start = startOfToday.getTime() - (days - 1 - i) * DAY_MS;
    return { start, end: start + DAY_MS, count: 0 };
  });
  for (const d of dates) {
    const t = new Date(d).getTime();
    if (Number.isNaN(t)) continue;
    const b = buckets.find((bucket) => t >= bucket.start && t < bucket.end);
    if (b) b.count += 1;
  }
  return buckets.map((b) => ({ start: new Date(b.start), count: b.count }));
}

/** Ticket counts per calendar month, oldest first. */
export function monthlyCounts(
  dates: string[],
  months = 6,
  now = Date.now(),
): { start: Date; count: number }[] {
  const currentMonth = new Date(now);
  currentMonth.setDate(1);
  currentMonth.setHours(0, 0, 0, 0);

  const buckets = Array.from({ length: months }, (_, i) => {
    const start = new Date(currentMonth);
    start.setMonth(currentMonth.getMonth() - (months - 1 - i));
    const end = new Date(start);
    end.setMonth(start.getMonth() + 1);
    return { start, end, count: 0 };
  });

  for (const d of dates) {
    const t = new Date(d).getTime();
    if (Number.isNaN(t)) continue;
    const b = buckets.find(
      (bucket) => t >= bucket.start.getTime() && t < bucket.end.getTime(),
    );
    if (b) b.count += 1;
  }

  return buckets.map((b) => ({ start: b.start, count: b.count }));
}

/** Mean resolution time per 7-day window, based on resolved ticket update date. */
export function resolutionTrend(
  tickets: MetricTicket[],
  weeks = 8,
  now = Date.now(),
): ResolutionTrendBucket[] {
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const end = now - (weeks - 1 - i) * 7 * DAY_MS;
    return { start: end - 7 * DAY_MS, end, durations: [] as number[] };
  });
  buckets[buckets.length - 1].end = now + DAY_MS;

  for (const ticket of tickets) {
    if (ticket.status !== "Resolved") continue;
    const resolvedAt = new Date(ticket.updatedAt).getTime();
    const createdAt = new Date(ticket.createdAt).getTime();
    if (Number.isNaN(resolvedAt) || Number.isNaN(createdAt)) continue;
    const bucket = buckets.find((b) => resolvedAt >= b.start && resolvedAt < b.end);
    if (bucket) bucket.durations.push(resolvedAt - createdAt);
  }

  return buckets.map((bucket) => {
    const totalHours =
      bucket.durations.reduce((sum, duration) => sum + duration, 0) /
      (60 * 60 * 1000);
    return {
      start: new Date(bucket.start),
      avgHours: bucket.durations.length ? totalHours / bucket.durations.length : null,
      count: bucket.durations.length,
    };
  });
}

/** Created tickets grouped by priority into weekly stacked buckets. */
export function priorityTrend(
  tickets: MetricTicket[],
  weeks = 6,
  now = Date.now(),
): PriorityTrendBucket[] {
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const end = now - (weeks - 1 - i) * 7 * DAY_MS;
    return {
      start: end - 7 * DAY_MS,
      end,
      counts: Object.fromEntries(priorityOrder.map((p) => [p, 0])) as Record<
        Priority,
        number
      >,
    };
  });
  buckets[buckets.length - 1].end = now + DAY_MS;

  for (const ticket of tickets) {
    const createdAt = new Date(ticket.createdAt).getTime();
    if (Number.isNaN(createdAt)) continue;
    const bucket = buckets.find((b) => createdAt >= b.start && createdAt < b.end);
    if (bucket) bucket.counts[ticket.priority] += 1;
  }

  return buckets.map((bucket) => ({
    start: new Date(bucket.start),
    counts: bucket.counts,
    total: priorityOrder.reduce((sum, p) => sum + bucket.counts[p], 0),
  }));
}

/** Aging of open/in-progress tickets. */
export function openAging(
  tickets: MetricTicket[],
  now = Date.now(),
): { oldestDays: number; over7: number; over30: number } {
  const active = tickets.filter(isActive);
  const ages = active.map((t) => (now - new Date(t.createdAt).getTime()) / DAY_MS);
  return {
    oldestDays: ages.length ? Math.floor(Math.max(...ages)) : 0,
    over7: ages.filter((a) => a >= 7).length,
    over30: ages.filter((a) => a >= 30).length,
  };
}

/** Mean create-to-resolve time (hours) over resolved tickets, or null if none. */
export function avgResolutionHours(tickets: MetricTicket[]): number | null {
  const resolved = tickets.filter((t) => t.status === "Resolved");
  if (resolved.length === 0) return null;
  const total = resolved.reduce(
    (sum, t) =>
      sum + (new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime()),
    0,
  );
  return total / resolved.length / (60 * 60 * 1000);
}
