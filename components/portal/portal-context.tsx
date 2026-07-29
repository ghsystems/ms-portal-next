import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  calculatePriority,
  getTicketStats,
  type ActivityItem,
  type Impact,
  type PortalTicket,
  type RequestType,
  type Urgency,
} from "@/components/portal/portal-data";
import { fetchTickets, type TicketSummary } from "@/lib/tickets";
import { useProfile, type Profile } from "@/hooks/useProfile";
import { PortalContext } from "@/components/portal/use-portal";

const POLL_INTERVAL_MS = 60 * 1000;

type NewTicketInput = {
  id: string;
  sysId: string;
  subject: string;
  description: string;
  requestType: RequestType;
  category: string;
  impact: Impact;
  urgency: Urgency;
  attachmentName: string | null;
};

export type PortalContextValue = {
  profile: Profile | null;
  currentUser: { name: string; company: string };
  tickets: TicketSummary[];
  ticketStats: ReturnType<typeof getTicketStats>;
  recentActivity: ActivityItem[];
  ticketsLoading: boolean;
  ticketsError: string | null;
  refetchTickets: () => void;
  addTicket: (input: NewTicketInput) => TicketSummary;
};

function makeActivityItem(ticket: TicketSummary): ActivityItem {
  return {
    id: `activity-${ticket.id}-${ticket.updatedAt}`,
    ticketId: ticket.id,
    title: ticket.subject,
    status: ticket.status,
    updatedAt: ticket.updatedAt,
    category: ticket.category,
  };
}

export function PortalProvider({ children }: { children: ReactNode }) {
  const { user, getAccessTokenSilently } = useAuth0();
  const { profile } = useProfile();
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadTickets = useCallback(async () => {
    try {
      const token = await getAccessTokenSilently();
      const { tickets: fetched, company } = await fetchTickets(token);
      setTickets(fetched);
      setCompanyName(company);
      setTicketsError(null);
    } catch (err) {
      setTicketsError(
        err instanceof Error
          ? err.message
          : "Failed to load tickets from ServiceNow.",
      );
    } finally {
      setTicketsLoading(false);
    }
  }, [getAccessTokenSilently]);

  useEffect(() => {
    loadTickets();

    pollRef.current = setInterval(loadTickets, POLL_INTERVAL_MS);

    const handleFocus = () => loadTickets();
    window.addEventListener("focus", handleFocus);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadTickets]);

  // Optimistically show a freshly submitted ticket, then reconcile with
  // ServiceNow's authoritative record (status/priority) on the next load.
  const addTicket = (input: NewTicketInput): TicketSummary => {
    const timestamp = new Date().toISOString();
    const ticket: TicketSummary = {
      id: input.id,
      sysId: input.sysId,
      subject: input.subject,
      description: input.description,
      requestType: input.requestType,
      category: input.category,
      status: "Open",
      impact: input.impact,
      urgency: input.urgency,
      priority: calculatePriority(input.impact, input.urgency),
      attachmentName: input.attachmentName,
      requester: user?.name ?? user?.email ?? "Portal User",
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    setTickets((previous) => [ticket, ...previous]);
    window.setTimeout(loadTickets, 3000);

    return ticket;
  };

  const ticketStats = useMemo(() => getTicketStats(tickets), [tickets]);
  const recentActivity = useMemo(
    () =>
      tickets
        .slice()
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .map(makeActivityItem),
    [tickets],
  );

  const value: PortalContextValue = {
    profile,
    currentUser: {
      name: user?.name ?? user?.email ?? "Portal User",
      company: companyName ?? "GHS Service Portal",
    },
    tickets,
    ticketStats,
    recentActivity,
    ticketsLoading,
    ticketsError,
    refetchTickets: loadTickets,
    addTicket,
  };

  return (
    <PortalContext.Provider value={value}>{children}</PortalContext.Provider>
  );
}

export type { PortalTicket };
