"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useAuth0 } from "@auth0/auth0-react";
import { apiFetch } from "@/lib/api";
import {
  bannerTypeConfig,
  type BannerType,
} from "@/components/portal/banner-config";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
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

type EventForm = {
  title: string;
  message: string;
  type: BannerType;
  starts_at_local: string;
  ends_at_local: string;
  all_clients: boolean;
  client_ids: string[];
};

const emptyForm: EventForm = {
  title: "",
  message: "",
  type: "maintenance",
  starts_at_local: "",
  ends_at_local: "",
  all_clients: false,
  client_ids: [],
};

function MaintenanceEventFormSkeleton() {
  return (
    <div
      className="grid gap-x-8 gap-y-5 sm:grid-cols-2"
      role="status"
      aria-label="Loading banner form"
    >
      <div className="space-y-2 sm:col-span-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
      {[...Array(4)].map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      ))}
      <div className="space-y-2 sm:col-span-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
      <span className="sr-only">Loading banner form</span>
    </div>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIso(local: string) {
  return new Date(local).toISOString();
}

function splitLocal(local: string) {
  const [date = "", time = ""] = local.split("T");
  return { date, time };
}

function joinLocal(date: string, time: string) {
  return date && time ? `${date}T${time}` : "";
}

export default function MaintenanceEventFormView() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const router = useRouter();
  const { getAccessTokenSilently, user } = useAuth0();

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState("");

  const [form, setForm] = useState<EventForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const filteredClients = useMemo(
    () =>
      clients.filter((c) =>
        c.name.toLowerCase().includes(clientSearch.trim().toLowerCase()),
      ),
    [clients, clientSearch],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const token = await getAccessTokenSilently();

      const [{ clients: clientList }, eventResp] = await Promise.all([
        apiFetch<{ clients: Client[] }>("/list-clients", token),
        isEdit
          ? apiFetch<{ event: MaintenanceEvent }>(
              `/maintenance-events?id=${encodeURIComponent(id!)}`,
              token,
            ).catch(() => null)
          : Promise.resolve(null),
      ]);

      setClients(clientList);

      if (isEdit) {
        if (!eventResp?.event) {
          setLoadError("This banner could not be found.");
        } else {
          const event = eventResp.event;
          setForm({
            title: event.title,
            message: event.message,
            type: event.type,
            starts_at_local: toLocalInput(event.starts_at),
            ends_at_local: toLocalInput(event.ends_at),
            all_clients: event.all_clients,
            client_ids: event.maintenance_event_clients.map((c) => c.client_id),
          });
        }
      } else {
        setForm(emptyForm);
      }
    } catch {
      setLoadError("Something went wrong loading this banner.");
    } finally {
      setLoading(false);
    }
  }, [getAccessTokenSilently, id, isEdit]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function toggleClient(clientId: string) {
    setForm((f) => ({
      ...f,
      client_ids: f.client_ids.includes(clientId)
        ? f.client_ids.filter((c) => c !== clientId)
        : [...f.client_ids, clientId],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.all_clients && form.client_ids.length === 0) {
      toast.error("Select at least one client, or choose All Clients.");
      return;
    }
    if (new Date(form.ends_at_local) <= new Date(form.starts_at_local)) {
      toast.error("End time must be after the start time.");
      return;
    }

    setSubmitting(true);
    try {
      const token = await getAccessTokenSilently();

      // One call: the endpoint validates, replaces the client links and writes
      // the audit entry server-side, so a half-applied edit can't be left behind.
      await apiFetch("/maintenance-events", token, {
        method: isEdit ? "PATCH" : "POST",
        body: JSON.stringify({
          ...(isEdit ? { id } : {}),
          title: form.title,
          message: form.message,
          type: form.type,
          starts_at: toIso(form.starts_at_local),
          ends_at: toIso(form.ends_at_local),
          all_clients: form.all_clients,
          client_ids: form.client_ids,
        }),
      });

      toast.success(isEdit ? "Banner updated." : "Banner created.");
      router.push("/admin/maintenance-events");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl font-light text-foreground tracking-normal">
            {isEdit ? "Edit Banner" : "New Banner"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Affected clients will see this in a portal banner from the start
            time until the end time.
          </p>
        </div>
        <Link
          href="/admin/maintenance-events"
          className={buttonVariants({ variant: "outline" })}
        >
          Back to Banners
        </Link>
      </div>

      <div className="mt-6 rounded-3xl border border-border bg-card/40 p-6 shadow-lg shadow-black/5 backdrop-blur-2xl backdrop-saturate-50 lg:p-8">
        {loading ? (
          <MaintenanceEventFormSkeleton />
        ) : loadError ? (
          <p className="text-sm text-rose-700">{loadError}</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="field-label mb-2 block">Title</label>
                <input
                  className="field-input"
                  type="text"
                  placeholder="Firewall upgrade"
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="field-label mb-2 block">Banner Type</label>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.keys(bannerTypeConfig) as BannerType[]).map(
                    (type) => (
                      <Button
                        key={type}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, type }))}
                        variant={form.type === type ? "default" : "outline"}
                        className="h-auto justify-start rounded-xl px-3 py-2.5 text-left"
                      >
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full shrink-0",
                            form.type === type
                              ? "bg-card"
                              : bannerTypeConfig[type].dot,
                          )}
                        />
                        {bannerTypeConfig[type].label}
                      </Button>
                    ),
                  )}
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="field-label mb-2 block">Message</label>
                <textarea
                  className="field-input resize-none"
                  placeholder="We will be performing a firewall upgrade. Some services may briefly be unavailable."
                  value={form.message}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, message: e.target.value }))
                  }
                  rows={3}
                  required
                />
              </div>

              <div>
                <label className="field-label mb-2 block">Starts</label>
                <div className="flex gap-2">
                  <input
                    className="field-input flex-1"
                    type="date"
                    value={splitLocal(form.starts_at_local).date}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        starts_at_local: joinLocal(
                          e.target.value,
                          splitLocal(f.starts_at_local).time || "00:00",
                        ),
                      }))
                    }
                    required
                  />
                  <input
                    className="field-input w-32"
                    type="time"
                    value={splitLocal(form.starts_at_local).time}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        starts_at_local: joinLocal(
                          splitLocal(f.starts_at_local).date,
                          e.target.value,
                        ),
                      }))
                    }
                    required
                  />
                </div>
              </div>
              <div>
                <label className="field-label mb-2 block">Ends</label>
                <div className="flex gap-2">
                  <input
                    className="field-input flex-1"
                    type="date"
                    value={splitLocal(form.ends_at_local).date}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        ends_at_local: joinLocal(
                          e.target.value,
                          splitLocal(f.ends_at_local).time || "00:00",
                        ),
                      }))
                    }
                    required
                  />
                  <input
                    className="field-input w-32"
                    type="time"
                    value={splitLocal(form.ends_at_local).time}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        ends_at_local: joinLocal(
                          splitLocal(f.ends_at_local).date,
                          e.target.value,
                        ),
                      }))
                    }
                    required
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="field-label">Audience</label>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={form.all_clients}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          all_clients: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-border"
                    />
                    All Clients
                  </label>
                </div>
                {!form.all_clients && (
                  <>
                    <input
                      className="field-input mt-2"
                      type="search"
                      placeholder="Search clients..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                    />
                    <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-border p-2 grid grid-cols-2 gap-x-2">
                      {filteredClients.length === 0 ? (
                        <p className="col-span-2 px-2 py-1.5 text-sm text-muted-foreground">
                          {clients.length === 0
                            ? "No clients found."
                            : "No clients match your search."}
                        </p>
                      ) : (
                        filteredClients.map((c) => (
                          <label
                            key={c.id}
                            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-foreground hover:bg-muted"
                          >
                            <input
                              type="checkbox"
                              checked={form.client_ids.includes(c.id)}
                              onChange={() => toggleClient(c.id)}
                              className="h-4 w-4 rounded border-border"
                            />
                            {c.name}
                          </label>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/admin/maintenance-events"
                className={buttonVariants({ variant: "outline" })}
              >
                Cancel
              </Link>
              <Button type="submit" disabled={submitting}>
                {submitting
                  ? "Saving..."
                  : isEdit
                    ? "Save Changes"
                    : "Create Banner"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
