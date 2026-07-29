import { useCallback, useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  defaultSupportContacts,
  fetchSupportContacts,
  saveSupportContacts,
  type SupportContacts,
} from "@/lib/support-contacts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

function SupportContactsFormSkeleton() {
  return (
    <div
      className="grid gap-x-8 gap-y-5 sm:grid-cols-2"
      role="status"
      aria-label="Loading support contacts"
    >
      <div className="space-y-2 sm:col-span-2">
        <Skeleton className="h-4 w-56" />
      </div>
      {[...Array(6)].map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      ))}
      <span className="sr-only">Loading support contacts</span>
    </div>
  );
}

export default function SupportContactsView() {
  const { getAccessTokenSilently } = useAuth0();

  const [form, setForm] = useState<SupportContacts>(defaultSupportContacts);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const token = await getAccessTokenSilently();
      const contacts = await fetchSupportContacts(token);
      setForm(contacts);
    } catch {
      setLoadError("Something went wrong loading support contacts.");
    } finally {
      setLoading(false);
    }
  }, [getAccessTokenSilently]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const token = await getAccessTokenSilently();
      // The save endpoint writes its own audit entry server-side.
      await saveSupportContacts(token, form);
      toast.success("Support contacts saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  function update(field: keyof SupportContacts, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  return (
    <>
      <div>
        <h1 className="font-display text-4xl font-light text-foreground tracking-normal">
          Support Contacts
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage the GHS support contact details shown in the client portal.
          Changes publish immediately for all users on next page load.
        </p>
      </div>

      <div className="mt-6 rounded-3xl border border-border bg-card/40 p-6 shadow-lg shadow-black/5 backdrop-blur-2xl backdrop-saturate-50 lg:p-8">
        {loading ? (
          <SupportContactsFormSkeleton />
        ) : loadError ? (
          <p className="text-sm text-rose-700">{loadError}</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Managed Services Support
                </h2>
              </div>
              <div>
                <label className="field-label mb-2 block">Email</label>
                <input
                  className="field-input"
                  type="email"
                  value={form.managedServicesEmail}
                  onChange={(e) => update("managedServicesEmail", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="field-label mb-2 block">Phone</label>
                <input
                  className="field-input"
                  type="tel"
                  value={form.managedServicesPhone}
                  onChange={(e) => update("managedServicesPhone", e.target.value)}
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="field-label mb-2 block">
                  24/7 Hotline Number
                </label>
                <input
                  className="field-input"
                  type="tel"
                  value={form.hotlinePhone}
                  onChange={(e) => update("hotlinePhone", e.target.value)}
                  required
                />
              </div>

              <div className="sm:col-span-2 mt-2">
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Escalation Manager
                </h2>
              </div>
              <div className="sm:col-span-2">
                <label className="field-label mb-2 block">Name</label>
                <input
                  className="field-input"
                  type="text"
                  value={form.escalationManagerName}
                  onChange={(e) => update("escalationManagerName", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="field-label mb-2 block">Email</label>
                <input
                  className="field-input"
                  type="email"
                  value={form.escalationManagerEmail}
                  onChange={(e) => update("escalationManagerEmail", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="field-label mb-2 block">Phone</label>
                <input
                  className="field-input"
                  type="tel"
                  value={form.escalationManagerPhone}
                  onChange={(e) => update("escalationManagerPhone", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button
                type="submit"
                disabled={submitting}
              >
                {submitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
