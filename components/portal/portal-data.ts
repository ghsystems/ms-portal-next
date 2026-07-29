export const routeDefinitions = [
  {
    path: "/portal",
    name: "Dashboard",
    description:
      "Primary overview page with request creation, ticket summary, support info, and activity.",
  },
  {
    path: "/portal/new-request",
    name: "New Request",
    description:
      "Submit a new service request to the GHS managed services team.",
  },
  {
    path: "/portal/tickets",
    name: "Tickets",
    description:
      "List and manage submitted tickets with filtering, status updates, and detail preview.",
  },
  {
    path: "/portal/reports",
    name: "Reports & Maintenance",
    description: "Show upcoming maintenance items and downloadable report cards.",
  },
] as const;

export type RoutePath = (typeof routeDefinitions)[number]["path"];

export const requestTypes = [
  "Incident",
  "Change Request",
  "Service Request",
] as const;

export const impactOptions = ["Low", "Medium", "High", "Critical"] as const;
export const urgencyOptions = ["Low", "Medium", "High", "Immediate"] as const;
export const ticketStatuses = ["Open", "In Progress", "Resolved"] as const;
export const maintenanceStatuses = [
  "Scheduled",
  "In Progress",
  "Completed",
] as const;
export type RequestType = (typeof requestTypes)[number];
export type Impact = (typeof impactOptions)[number];
export type Urgency = (typeof urgencyOptions)[number];
export type TicketStatus = (typeof ticketStatuses)[number];
export type Priority = "Low" | "Medium" | "High" | "Critical";
export type MaintenanceStatus = (typeof maintenanceStatuses)[number];

export type TicketLogEntry = {
  id: string;
  actor: string;
  message: string;
  timestamp: string;
};

export type PortalTicket = {
  id: string;
  sysId: string;
  subject: string;
  description: string;
  requestType: RequestType;
  category: string;
  status: TicketStatus;
  impact: Impact;
  urgency: Urgency;
  priority: Priority;
  attachmentName: string | null;
  requester: string;
  createdAt: string;
  updatedAt: string;
  activityLog: TicketLogEntry[];
};

export type ActivityItem = {
  id: string;
  ticketId: string;
  title: string;
  status: string;
  updatedAt: string;
  category: string;
};

export type MaintenanceItem = {
  id: string;
  title: string;
  date: string;
  description: string;
  status: MaintenanceStatus;
};

export type ReportType =
  | "Monthly Managed Services Report"
  | "Major Incident Report"
  | "Annual SOC 2 Report"
  | "Invoice";

export const reportTypes: ReportType[] = [
  "Monthly Managed Services Report",
  "Major Incident Report",
  "Annual SOC 2 Report",
  "Invoice",
];

export type ReportItem = {
  id: string;
  title: string;
  type: ReportType;
  date: string;
};

export const maintenanceItems: MaintenanceItem[] = [
  {
    id: "maint-01",
    title: "Quarterly Azure SQL patch window",
    date: "2026-04-12",
    description:
      "Read replica patching and failover rehearsal for analytics workloads. No expected business outage.",
    status: "Scheduled",
  },
  {
    id: "maint-02",
    title: "Global edge firewall policy deployment",
    date: "2026-04-15",
    description:
      "Security baseline refresh across corporate ingress points with staged validation.",
    status: "Scheduled",
  },
  {
    id: "maint-03",
    title: "Backup integrity validation exercise",
    date: "2026-04-08",
    description:
      "Recovery drill in progress for executive reporting datasets and gold images.",
    status: "In Progress",
  },
];

export const reportItems: ReportItem[] = [
  { id: "report-01", title: "Monthly Managed Services Report – May 2026", type: "Monthly Managed Services Report", date: "2026-06-02" },
  { id: "report-02", title: "Monthly Managed Services Report – Apr 2026", type: "Monthly Managed Services Report", date: "2026-05-05" },
  { id: "report-03", title: "Monthly Managed Services Report – Mar 2026", type: "Monthly Managed Services Report", date: "2026-04-03" },
  { id: "report-04", title: "Major Incident Report – Azure Outage (14 Apr 2026)", type: "Major Incident Report", date: "2026-04-18" },
  { id: "report-05", title: "Major Incident Report – VPN Degradation (22 Jan 2026)", type: "Major Incident Report", date: "2026-01-28" },
  { id: "report-06", title: "Annual SOC 2 Type II Report – FY 2025", type: "Annual SOC 2 Report", date: "2026-03-15" },
];

const impactRank: Record<Impact, number> = {
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4,
};

const urgencyRank: Record<Urgency, number> = {
  Low: 1,
  Medium: 2,
  High: 3,
  Immediate: 4,
};

export function calculatePriority(impact: Impact, urgency: Urgency): Priority {
  const score = impactRank[impact] + urgencyRank[urgency];

  if (
    (impact === "Critical" && urgency !== "Low") ||
    (urgency === "Immediate" && impact !== "Low") ||
    score >= 8
  ) {
    return "Critical";
  }

  if (impact === "Critical" || urgency === "Immediate" || score >= 6) {
    return "High";
  }

  if (score >= 4) {
    return "Medium";
  }

  return "Low";
}

export function getTicketStats(tickets: Array<{ status: TicketStatus }>) {
  return tickets.reduce(
    (stats, ticket) => {
      if (ticket.status === "Open") {
        stats.open += 1;
      }

      if (ticket.status === "In Progress") {
        stats.inProgress += 1;
      }

      if (ticket.status === "Resolved") {
        stats.resolved += 1;
      }

      return stats;
    },
    { open: 0, inProgress: 0, resolved: 0 },
  );
}

