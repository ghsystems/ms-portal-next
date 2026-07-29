import type {
  Impact,
  PortalTicket,
  Priority,
  RequestType,
  TicketLogEntry,
  TicketStatus,
  Urgency,
} from "@/components/portal/portal-data";
import { API_BASE_URL } from "./api";

export type TicketSummary = Omit<PortalTicket, "activityLog">;

type RawTicket = {
  id: string;
  sysId: string;
  subject: string;
  description: string;
  requestType: string;
  category: string;
  status: string;
  impact: string;
  urgency: string;
  priority: string;
  requester: string;
  createdAt: string;
  updatedAt: string;
  activityLog?: TicketLogEntry[];
};

function normalizeTicket(raw: RawTicket): TicketSummary & { sysId: string } {
  return {
    id: raw.id,
    sysId: raw.sysId,
    subject: raw.subject,
    description: raw.description,
    requestType: raw.requestType as RequestType,
    category: raw.category,
    status: raw.status as TicketStatus,
    impact: raw.impact as Impact,
    urgency: raw.urgency as Urgency,
    priority: raw.priority as Priority,
    requester: raw.requester,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    attachmentName: null,
  };
}

async function callListTickets(token: string, sysId?: string) {
  const url = new URL(`${API_BASE_URL}/list-tickets`);
  if (sysId) url.searchParams.set("sys_id", sysId);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error ?? "Failed to load tickets from ServiceNow.",
    );
  }

  return data;
}

export async function fetchTickets(token: string): Promise<{
  tickets: Array<TicketSummary & { sysId: string }>;
  company: string | null;
}> {
  const data = (await callListTickets(token)) as {
    tickets: RawTicket[];
    company: string | null;
  };
  return { tickets: data.tickets.map(normalizeTicket), company: data.company };
}

export async function fetchTicketDetail(
  token: string,
  sysId: string,
): Promise<PortalTicket & { sysId: string }> {
  const data = (await callListTickets(token, sysId)) as { ticket: RawTicket };
  return {
    ...normalizeTicket(data.ticket),
    activityLog: data.ticket.activityLog ?? [],
  };
}
