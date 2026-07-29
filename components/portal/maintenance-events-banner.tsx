import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { bannerTypeConfig, type BannerType } from "@/components/portal/banner-config";
import { formatDateTime } from "@/components/portal/portal-utils";
import { PortalIcon } from "@/components/portal/portal-ui";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  addDismissedId,
  getDismissedIds,
} from "@/components/portal/maintenance-events-storage";

type MaintenanceEvent = {
  id: string;
  title: string;
  message: string;
  type: BannerType;
  starts_at: string;
  ends_at: string;
};

export default function MaintenanceEventsBanner() {
  const { getAccessTokenSilently } = useAuth0();
  const [events, setEvents] = useState<MaintenanceEvent[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>(getDismissedIds);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const token = await getAccessTokenSilently();
        const { events: data } = await apiFetch<{ events: MaintenanceEvent[] }>(
          "/maintenance-events",
          token,
        );
        const now = Date.now();
        if (!cancelled) {
          setEvents(
            data
              .filter((e) => Date.parse(e.ends_at) > now)
              .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
          );
        }
      } catch {
        // table may not exist yet, or user has no scoped events; show nothing
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [getAccessTokenSilently]);

  const visibleEvents = events.filter((e) => !dismissedIds.includes(e.id));

  if (visibleEvents.length === 0) return null;

  function handleDismiss(id: string) {
    addDismissedId(id);
    setDismissedIds((ids) => [...ids, id]);
  }

  return (
    <div className="space-y-2 px-6 pt-4">
      <div className="mx-auto max-w-screen-2xl space-y-2">
        {visibleEvents.map((event) => {
          const style = bannerTypeConfig[event.type];
          return (
            <Alert
              key={event.id}
              className={cn("shadow-sm backdrop-blur", style.alert)}
            >
              <PortalIcon
                name="bell"
                className={cn("shrink-0", style.icon)}
              />
              <AlertTitle className="min-w-0 pr-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em]">
                    {style.label}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {formatDateTime(event.starts_at)} - {formatDateTime(event.ends_at)}
                  </span>
                </div>
                <span className="mt-1 block text-sm font-semibold leading-snug">
                  {event.title}
                </span>
              </AlertTitle>
              <AlertDescription className={cn("pr-2", style.description)}>
                {event.message}
              </AlertDescription>
              <AlertAction>
                <Button
                  type="button"
                  onClick={() => handleDismiss(event.id)}
                  aria-label="Dismiss"
                  variant="ghost"
                  size="icon-xs"
                  className={style.action}
                >
                  <PortalIcon name="close" className="h-4 w-4" />
                </Button>
              </AlertAction>
            </Alert>
          );
        })}
      </div>
    </div>
  );
}
