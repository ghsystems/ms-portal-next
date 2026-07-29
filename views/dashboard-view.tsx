import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  defaultSupportContacts,
  fetchSupportContacts,
  type SupportContacts,
} from "@/lib/support-contacts";
import { usePortal } from "@/components/portal/use-portal";
import { PortalIcon, StatusBadge } from "@/components/portal/portal-ui";
import { formatDate, timeAgo } from "@/components/portal/portal-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { P1IncidentButton } from "@/components/portal/p1-incident-dialog";
import {
  agingBuckets,
  avgResolutionHours,
  dailyCounts,
  monthlyCounts,
  priorityBreakdown,
  priorityOrder,
  priorityTrend,
  requestTypeBreakdown,
  resolutionTrend,
  statusBreakdown,
  type MetricTicket,
  type PriorityTrendBucket,
  type ResolutionTrendBucket,
  type Segment,
} from "@/lib/dashboard-metrics";

const priorityColor: Record<string, string> = {
  Critical: "#dc2626",
  High: "#fca5a5",
  Medium: "#facc15",
  Low: "#cbd5e1",
};

const statusColor: Record<string, string> = {
  Open: "#0ea5e9",
  "In Progress": "#f59e0b",
  Resolved: "#10b981",
};

const requestTypeColor: Record<string, string> = {
  Incident: "#ef4444",
  "Change Request": "#6366f1",
  "Service Request": "#14b8a6",
};

const agingColor: Record<string, string> = {
  "0-7d": "#10b981",
  "7-30d": "#f59e0b",
  "30d+": "#dc2626",
};

type MaintenanceEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
};

function Panel({
  title,
  children,
  action,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`glass-panel px-6 py-6 ${className}`}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-medium text-foreground">{title}</h2>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ChartCard({
  title,
  description,
  children,
  action,
  className = "",
  contentClassName = "min-h-52",
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section
      className={`rounded-[28px] border border-border bg-card/70 p-5 shadow-sm ${className}`}
    >
      <div className="flex min-h-12 items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={`mt-5 ${contentClassName}`}>{children}</div>
    </section>
  );
}

function Donut({
  segments,
  colors,
  sizeClass = "h-32 w-32",
}: {
  segments: Segment[];
  colors: Record<string, string>;
  sizeClass?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 100 100" className={`${sizeClass} shrink-0 -rotate-90`}>
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth="12"
        />
        {total > 0 &&
          segments
            .filter((s) => s.count > 0)
            .map((s) => {
              const len = (s.count / total) * c;
              const dash = (
                <circle
                  key={s.label}
                  cx="50"
                  cy="50"
                  r={r}
                  fill="none"
                  stroke={colors[s.label]}
                  strokeWidth="12"
                  strokeDasharray={`${len} ${c - len}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += len;
              return dash;
            })}
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          className="rotate-90"
          transform="rotate(90 50 50)"
          style={{ fontSize: 18, fontWeight: 600, fill: "#0f172a" }}
        >
          {total}
        </text>
      </svg>
      <ul className="space-y-2 text-sm">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: colors[s.label] }}
            />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="ml-auto font-semibold text-foreground">
              {s.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function axisLabels(max: number) {
  if (max <= 1) return [1, 0];
  return [max, Math.ceil(max / 2), 0];
}

function AxisBarChart({
  segments,
  colors,
  heightClass = "h-36",
  barWidthClass = "w-full",
  gapClass = "gap-4",
  labelClass = "text-xs",
}: {
  segments: Segment[];
  colors: Record<string, string>;
  heightClass?: string;
  barWidthClass?: string;
  gapClass?: string;
  labelClass?: string;
}) {
  const max = Math.max(1, ...segments.map((s) => s.count));
  const ticks = axisLabels(max);

  return (
    <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
      <div
        className={`flex ${heightClass} flex-col justify-between text-right text-xs font-medium text-muted-foreground`}
      >
        {ticks.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
      <div>
        <div
          className={`flex ${heightClass} ${gapClass} items-end border-l border-b border-border pl-3`}
        >
          {segments.map((s) => (
            <div
              key={s.label}
              className="flex h-full min-w-0 flex-1 items-end"
              title={`${s.label}: ${s.count}`}
            >
              <div
                className={`${barWidthClass} rounded-t-[2px] transition-all`}
                style={{
                  height: `${Math.max(6, (s.count / max) * 100)}%`,
                  backgroundColor: colors[s.label],
                }}
              />
            </div>
          ))}
        </div>
        <div className={`mt-2 flex ${gapClass} pl-3`}>
          {segments.map((s) => (
            <span
              key={s.label}
              className={`min-w-0 flex-1 whitespace-normal text-center ${labelClass} font-medium leading-tight text-muted-foreground`}
            >
              {s.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function RequestsBarChart({
  data,
  heightClass = "h-40",
}: {
  data: { start: Date; count: number }[];
  heightClass?: string;
}) {
  const segments = data.map((d) => ({
    label: d.start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    count: d.count,
  }));
  const colors = Object.fromEntries(
    segments.map((segment) => [segment.label, "#0ea5e9"]),
  );

  return (
    <AxisBarChart
      segments={segments}
      colors={colors}
      heightClass={heightClass}
      gapClass="gap-2"
      labelClass="text-[10px]"
    />
  );
}

function MonthlyVolumeChart({
  data,
  heightClass = "h-40",
}: {
  data: { start: Date; count: number }[];
  heightClass?: string;
}) {
  const segments = data.map((d) => ({
    label: d.start.toLocaleDateString("en-US", { month: "short" }),
    count: d.count,
  }));
  const colors = Object.fromEntries(
    segments.map((segment) => [segment.label, "#14b8a6"]),
  );

  return (
    <AxisBarChart
      segments={segments}
      colors={colors}
      heightClass={heightClass}
      gapClass="gap-3"
      labelClass="text-xs"
    />
  );
}

function ResolutionTrendChart({
  data,
  heightClass = "h-40",
}: {
  data: ResolutionTrendBucket[];
  heightClass?: string;
}) {
  const values = data
    .map((bucket) => bucket.avgHours)
    .filter((value): value is number => value !== null);
  const max = Math.max(1, ...values);
  const points = data
    .map((bucket, index) => {
      if (bucket.avgHours === null) return null;
      const x = data.length <= 1 ? 50 : (index / (data.length - 1)) * 100;
      const y = 42 - (bucket.avgHours / max) * 34;
      return { x, y, bucket };
    })
    .filter(
      (
        point,
      ): point is { x: number; y: number; bucket: ResolutionTrendBucket } =>
        point !== null,
    );
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  return (
    <div>
      <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
        <div
          className={`flex ${heightClass} flex-col justify-between text-right text-xs font-medium text-muted-foreground`}
        >
          <span>{Math.round(max)}h</span>
          <span>0</span>
        </div>
        <div>
          <svg
            viewBox="0 0 100 48"
            preserveAspectRatio="none"
            className={`${heightClass} w-full overflow-visible border-l border-b border-border`}
          >
            <line
              x1="0"
              x2="100"
              y1="24"
              y2="24"
              stroke="currentColor"
              className="text-border"
              strokeWidth="0.5"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={path}
              fill="none"
              stroke="#6366f1"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
            {points.map((point) => (
              <circle
                key={point.bucket.start.toISOString()}
                cx={point.x}
                cy={point.y}
                r="2"
                fill="#6366f1"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
          <div className="mt-2 flex justify-between pl-3 text-[10px] font-medium leading-tight text-muted-foreground">
            {data.map((bucket) => (
              <span key={bucket.start.toISOString()}>
                {bucket.start.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Average create-to-resolve time by week.
      </p>
    </div>
  );
}

function PriorityTrendChart({
  data,
  heightClass = "h-40",
}: {
  data: PriorityTrendBucket[];
  heightClass?: string;
}) {
  const max = Math.max(1, ...data.map((bucket) => bucket.total));

  return (
    <div>
      <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
        <div
          className={`flex ${heightClass} flex-col justify-between text-right text-xs font-medium text-muted-foreground`}
        >
          <span>{max}</span>
          <span>{Math.ceil(max / 2)}</span>
          <span>0</span>
        </div>
        <div>
          <div
            className={`flex ${heightClass} gap-3 items-end border-l border-b border-border pl-3`}
          >
            {data.map((bucket) => (
              <div
                key={bucket.start.toISOString()}
                className="flex h-full min-w-0 flex-1 items-end"
                title={`${bucket.total} tickets`}
              >
                <div
                  className="mx-auto flex w-full max-w-14 flex-col-reverse overflow-hidden rounded-t-[2px]"
                  style={{
                    height: `${Math.max(6, (bucket.total / max) * 100)}%`,
                  }}
                >
                  {priorityOrder.map((priorityName) => {
                    const count = bucket.counts[priorityName];
                    if (count === 0 || bucket.total === 0) return null;
                    return (
                      <div
                        key={priorityName}
                        style={{
                          height: `${(count / bucket.total) * 100}%`,
                          backgroundColor: priorityColor[priorityName],
                        }}
                        title={`${priorityName}: ${count}`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-3 pl-3">
            {data.map((bucket) => (
              <span
                key={bucket.start.toISOString()}
                className="min-w-0 flex-1 text-center text-[10px] font-medium leading-tight text-muted-foreground"
              >
                {bucket.start.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
        {priorityOrder.map((priorityName) => (
          <span
            key={priorityName}
            className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: priorityColor[priorityName] }}
            />
            {priorityName}
          </span>
        ))}
      </div>
    </div>
  );
}

function DonutChartSkeleton({
  sizeClass = "h-32 w-32",
}: {
  sizeClass?: string;
}) {
  return (
    <div
      className="flex items-center gap-6"
      role="status"
      aria-label="Loading chart"
    >
      <Skeleton className={`${sizeClass} shrink-0 rounded-full`} />
      <div className="min-w-0 flex-1 space-y-3">
        {[...Array(3)].map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="h-2.5 w-2.5 rounded-full" />
            <Skeleton className="h-4 w-28 max-w-[70%]" />
            <Skeleton className="ml-auto h-4 w-8" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading chart</span>
    </div>
  );
}

function BarChartSkeleton({
  bars = 4,
  heightClass = "h-36",
  gapClass = "gap-4",
}: {
  bars?: number;
  heightClass?: string;
  gapClass?: string;
}) {
  const heights = ["62%", "88%", "44%", "72%", "55%", "78%", "38%"];

  return (
    <div
      className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3"
      role="status"
      aria-label="Loading bar chart"
    >
      <div className={`flex ${heightClass} flex-col justify-between`}>
        {[...Array(3)].map((_, index) => (
          <Skeleton key={index} className="ml-auto h-3 w-4" />
        ))}
      </div>
      <div>
        <div
          className={`flex ${heightClass} ${gapClass} items-end border-l border-b border-border pl-3`}
        >
          {[...Array(bars)].map((_, index) => (
            <div key={index} className="flex h-full min-w-0 flex-1 items-end">
              <Skeleton
                className="mx-auto w-full max-w-14 rounded-t-[2px] rounded-b-none"
                style={{ height: heights[index % heights.length] }}
              />
            </div>
          ))}
        </div>
        <div className={`mt-2 flex ${gapClass} pl-3`}>
          {[...Array(bars)].map((_, index) => (
            <Skeleton key={index} className="mx-auto h-3 min-w-0 flex-1" />
          ))}
        </div>
      </div>
      <span className="sr-only">Loading bar chart</span>
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div
      className="space-y-4"
      role="status"
      aria-label="Loading recent activity"
    >
      {[...Array(5)].map((_, index) => (
        <div key={index} className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-36" />
          </div>
          <Skeleton className="h-7 w-24 rounded-full" />
        </div>
      ))}
      <span className="sr-only">Loading recent activity</span>
    </div>
  );
}

export default function DashboardView() {
  const {
    profile,
    currentUser,
    tickets,
    recentActivity,
    ticketsLoading,
    ticketsError,
  } = usePortal();
  const { getAccessTokenSilently } = useAuth0();

  const isP1Authorized = profile?.p1_authorized === true;

  const [supportContacts, setSupportContacts] = useState<SupportContacts>(
    defaultSupportContacts,
  );
  const [maintenance, setMaintenance] = useState<MaintenanceEvent[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessTokenSilently();
        const contacts = await fetchSupportContacts(token);
        if (!cancelled) setSupportContacts(contacts);

        const { events } = await apiFetch<{ events: MaintenanceEvent[] }>(
          "/maintenance-events",
          token,
        );
        const now = Date.now();
        if (!cancelled) {
          setMaintenance(
            events
              .filter((e) => Date.parse(e.ends_at) > now)
              .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
              .slice(0, 4),
          );
        }
      } catch {
        // keep defaults / empty on any failure
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getAccessTokenSilently]);

  const metricTickets = tickets as unknown as MetricTicket[];
  const priority = useMemo(
    () => priorityBreakdown(metricTickets),
    [metricTickets],
  );
  const aging = useMemo(() => agingBuckets(metricTickets), [metricTickets]);
  const status = useMemo(() => statusBreakdown(metricTickets), [metricTickets]);
  const requestType = useMemo(
    () => requestTypeBreakdown(metricTickets),
    [metricTickets],
  );
  const daily = useMemo(
    () =>
      dailyCounts(
        tickets.map((t) => t.createdAt),
        7,
      ),
    [tickets],
  );
  const monthly = useMemo(
    () =>
      monthlyCounts(
        tickets.map((t) => t.createdAt),
        6,
      ),
    [tickets],
  );
  const resolvedTrend = useMemo(
    () => resolutionTrend(metricTickets, 8),
    [metricTickets],
  );
  const priorityByWeek = useMemo(
    () => priorityTrend(metricTickets, 6),
    [metricTickets],
  );
  const avgHours = useMemo(
    () => avgResolutionHours(metricTickets),
    [metricTickets],
  );
  const hasTickets = tickets.length > 0;
  const hasActiveTickets = priority.some((segment) => segment.count > 0);
  const hasResolvedTrend = resolvedTrend.some((bucket) => bucket.count > 0);

  const avgLabel =
    avgHours == null
      ? "-"
      : avgHours < 48
        ? `${Math.round(avgHours)}h`
        : `${Math.round(avgHours / 24)}d`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            {currentUser.company}
          </p>
          <h1 className="text-gradient-brand mt-1 font-display text-4xl font-light">
            Welcome back, {currentUser.name.split(" ")[0]}
          </h1>
        </div>
        <div className="flex flex-wrap gap-3">
          {isP1Authorized ? <P1IncidentButton /> : null}
          <Link
            href="/portal/new-request"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-primary/90"
          >
            <PortalIcon name="compose" className="h-4 w-4" />
            New request
          </Link>
        </div>
      </div>

      <Panel title="">
        <div className="space-y-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-stretch">
            <ChartCard
              title="Tickets by status"
              description="Current ticket state."
              className="xl:flex-1"
              contentClassName="min-h-48"
            >
              {ticketsLoading ? (
                <DonutChartSkeleton sizeClass="h-36 w-36" />
              ) : hasTickets ? (
                <Donut
                  segments={status}
                  colors={statusColor}
                  sizeClass="h-36 w-36"
                />
              ) : (
                <EmptyChart />
              )}
            </ChartCard>
            <ChartCard
              title="Open tickets by priority"
              description="Severity split for active tickets."
              className="xl:flex-1"
              contentClassName="min-h-48"
            >
              {ticketsLoading ? (
                <BarChartSkeleton heightClass="h-44" />
              ) : hasActiveTickets ? (
                <AxisBarChart
                  segments={priority}
                  colors={priorityColor}
                  heightClass="h-44"
                  barWidthClass="mx-auto w-full max-w-14"
                />
              ) : (
                <EmptyMetric message="No open tickets right now." />
              )}
            </ChartCard>
            <ChartCard
              title="Open ticket aging"
              description="How long active tickets have been open."
              className="xl:flex-1"
              contentClassName="min-h-48"
            >
              {ticketsLoading ? (
                <BarChartSkeleton bars={3} heightClass="h-44" />
              ) : hasActiveTickets ? (
                <AxisBarChart
                  segments={aging}
                  colors={agingColor}
                  heightClass="h-44"
                  barWidthClass="mx-auto w-full max-w-16"
                />
              ) : (
                <EmptyMetric message="No open tickets to age." />
              )}
            </ChartCard>
          </div>

          <div className="flex flex-col gap-5 xl:flex-row xl:items-stretch">
            <ChartCard
              title="New requests - last 7 days"
              description="Daily request creation trend."
              className="xl:flex-1"
              contentClassName="min-h-64"
              action={
                ticketsLoading ? (
                  <Skeleton className="h-4 w-28" />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {avgHours == null
                      ? "no resolved tickets yet"
                      : `avg resolution ${avgLabel}`}
                  </span>
                )
              }
            >
              {ticketsLoading ? (
                <BarChartSkeleton
                  bars={7}
                  heightClass="h-56"
                  gapClass="gap-2"
                />
              ) : (
                <RequestsBarChart data={daily} heightClass="h-56" />
              )}
            </ChartCard>
            <ChartCard
              title="Requests by type"
              description="Incident, change, and service request mix."
              className="xl:flex-1"
              contentClassName="min-h-64"
            >
              {ticketsLoading ? (
                <DonutChartSkeleton sizeClass="h-48 w-48" />
              ) : hasTickets ? (
                <Donut
                  segments={requestType}
                  colors={requestTypeColor}
                  sizeClass="h-48 w-48"
                />
              ) : (
                <EmptyChart />
              )}
            </ChartCard>
          </div>

          <div className="flex flex-col gap-5 xl:flex-row xl:items-stretch">
            <ChartCard
              title="Priority over time"
              description="Weekly created tickets stacked by priority."
              className="xl:flex-1"
              contentClassName="min-h-60"
            >
              {ticketsLoading ? (
                <BarChartSkeleton
                  bars={6}
                  heightClass="h-52"
                  gapClass="gap-3"
                />
              ) : hasTickets ? (
                <PriorityTrendChart data={priorityByWeek} heightClass="h-52" />
              ) : (
                <EmptyChart />
              )}
            </ChartCard>
            <ChartCard
              title="Ticket volume - last 6 months"
              description="Monthly created ticket volume."
              className="xl:flex-1"
              contentClassName="min-h-60"
            >
              {ticketsLoading ? (
                <BarChartSkeleton
                  bars={6}
                  heightClass="h-52"
                  gapClass="gap-3"
                />
              ) : hasTickets ? (
                <MonthlyVolumeChart data={monthly} heightClass="h-52" />
              ) : (
                <EmptyChart />
              )}
            </ChartCard>
          </div>

          <div className="flex flex-col gap-5 xl:flex-row xl:items-stretch">
            <ChartCard
              title="Resolution time trend"
              description="Average create-to-resolve time by week."
              className="w-full"
              contentClassName="min-h-60"
            >
              {ticketsLoading ? (
                <BarChartSkeleton
                  bars={8}
                  heightClass="h-52"
                  gapClass="gap-2"
                />
              ) : hasResolvedTrend ? (
                <ResolutionTrendChart data={resolvedTrend} heightClass="h-52" />
              ) : (
                <EmptyMetric message="No resolved tickets yet." />
              )}
            </ChartCard>
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Recent activity"
          action={
            <Link
              href="/portal/tickets"
              className="text-sm font-semibold text-muted-foreground transition hover:text-foreground hover:underline"
            >
              View all
            </Link>
          }
        >
          <div className="divide-y divide-slate-100">
            {ticketsLoading ? (
              <ActivitySkeleton />
            ) : ticketsError ? (
              <p className="py-4 text-sm text-rose-700">{ticketsError}</p>
            ) : recentActivity.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                No tickets yet.
              </p>
            ) : (
              recentActivity.slice(0, 5).map((activity) => (
                <article
                  key={activity.id}
                  className="flex items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium text-foreground">
                      {activity.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {activity.ticketId} - {timeAgo(activity.updatedAt)}
                    </p>
                  </div>
                  <StatusBadge value={activity.status} className="shrink-0" />
                </article>
              ))
            )}
          </div>
        </Panel>

        <Panel
          title="Upcoming maintenance"
          action={
            <Link
              href="/portal/reports"
              className="text-sm font-semibold text-muted-foreground transition hover:text-foreground hover:underline"
            >
              View all
            </Link>
          }
        >
          {maintenance.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              No scheduled maintenance.
            </p>
          ) : (
            <ul className="space-y-4">
              {maintenance.map((event) => (
                <li key={event.id} className="flex gap-3">
                  <div className="mt-1 flex flex-col items-center">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                    <span className="mt-1 w-px flex-1 bg-muted" />
                  </div>
                  <div className="min-w-0 pb-1">
                    <p className="truncate text-base font-medium text-foreground">
                      {event.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDate(event.starts_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Support">
        <div className="grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Managed Services
            </p>
            <a
              href={`mailto:${supportContacts.managedServicesEmail}`}
              className="mt-1.5 block text-base text-foreground transition hover:text-foreground hover:underline"
            >
              {supportContacts.managedServicesEmail}
            </a>
            <p className="mt-0.5 text-base text-foreground">
              {supportContacts.managedServicesPhone}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              24/7 Hotline
            </p>
            <p className="mt-1.5 text-base text-foreground">
              {supportContacts.hotlinePhone}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Escalation Manager
            </p>
            <p className="mt-1.5 text-base text-foreground">
              {supportContacts.escalationManagerName}
            </p>
            <a
              href={`mailto:${supportContacts.escalationManagerEmail}`}
              className="mt-0.5 block text-base text-foreground transition hover:text-foreground hover:underline"
            >
              {supportContacts.escalationManagerEmail}
            </a>
            <p className="mt-0.5 text-base text-foreground">
              {supportContacts.escalationManagerPhone}
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function EmptyChart() {
  return (
    <p className="py-8 text-center text-sm text-muted-foreground">
      No tickets yet - this fills in as requests come through.
    </p>
  );
}

function EmptyMetric({ message }: { message: string }) {
  return (
    <p className="py-8 text-center text-sm text-muted-foreground">{message}</p>
  );
}
