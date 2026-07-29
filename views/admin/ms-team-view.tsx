import { useEffect, useState, useCallback } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useResizableCols } from "@/hooks/useResizableCols";

const TEAM_COLS = [
  { id: "email" as const,   label: "Email",   width: 500, minWidth: 200 },
  { id: "actions" as const, label: "Actions", width: 160, minWidth: 100 },
];
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PortalIcon } from "@/components/portal/portal-ui";
import { Trash2 } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { toast } from "sonner";

type MsTeamUser = {
  auth0_user_id: string;
  email: string;
  role: string;
};

function TeamTableSkeleton() {
  return (
    <div className="space-y-3 p-8" role="status" aria-label="Loading team members">
      {[...Array(4)].map((_, index) => (
        <div key={index} className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-64 max-w-full" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
      ))}
      <span className="sr-only">Loading team members</span>
    </div>
  );
}

export default function MSTeamView() {
  const { startResize, gridTemplate, totalWidth } = useResizableCols(TEAM_COLS);
  const { getAccessTokenSilently } = useAuth0();
  const [members, setMembers] = useState<MsTeamUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);

  const [removeTarget, setRemoveTarget] = useState<MsTeamUser | null>(null);
  const [removeSubmitting, setRemoveSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const token = await getAccessTokenSilently();
      const resp = await fetch(`${API_BASE_URL}/list-users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (resp.ok) {
        const { users } = await resp.json();
        setMembers(
          (users as MsTeamUser[]).filter((u) => u.role === "ghs_ms_team"),
        );
      }
    } catch {
      // network error - leave list empty
    } finally {
      setLoading(false);
    }
  }, [getAccessTokenSilently]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAddSubmitting(true);
    try {
      const token = await getAccessTokenSilently();
      // Reuse the same invite-email/password-setup flow client users get, just
      // with the MS Team role. invite-user already enforces admin-only access.
      const resp = await fetch(`${API_BASE_URL}/invite-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: addName.trim(),
          email: addEmail.trim(),
          role: "ghs_ms_team",
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? "Something went wrong");
      toast.success(`Invitation sent to ${addEmail.trim()}.`);
      setAddOpen(false);
      setAddName("");
      setAddEmail("");
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAddSubmitting(false);
    }
  }

  async function handleRemove() {
    if (!removeTarget) return;
    setRemoveSubmitting(true);
    try {
      const token = await getAccessTokenSilently();
      const resp = await fetch(`${API_BASE_URL}/set-ms-team-role`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: removeTarget.email, action: "remove" }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? "Something went wrong");
      toast.success(`${removeTarget.email} removed from MS Team.`);
      setRemoveTarget(null);
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setRemoveSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-4xl font-light text-foreground tracking-normal">
            MS Team
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            GHS internal staff authorized to publish reports to client portals.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setAddOpen(true)}
        >
          <span className="text-base leading-none">+</span>
          Add Member
        </Button>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-border bg-card/40 p-6 shadow-lg shadow-black/5 backdrop-blur-2xl backdrop-saturate-50">
          <p className="text-sm font-bold uppercase tracking-wider text-foreground">
            Team Members
          </p>
          {loading ? (
            <Skeleton className="mt-3 h-10 w-16" />
          ) : (
            <p className="mt-2 font-display text-4xl text-foreground">
              {members.length}
            </p>
          )}
        </div>
        <div className="rounded-3xl border border-border bg-card/40 p-6 shadow-lg shadow-black/5 backdrop-blur-2xl backdrop-saturate-50">
          <p className="text-sm font-bold uppercase tracking-wider text-foreground">
            Report Publishers
          </p>
          {loading ? (
            <Skeleton className="mt-3 h-10 w-16" />
          ) : (
            <p className="mt-2 font-display text-4xl text-foreground">
              {members.length}
            </p>
          )}
        </div>
      </div>

      <div className="data-table-shell mt-6">
        {loading ? (
          <TeamTableSkeleton />
        ) : members.length === 0 ? (
          <div className="data-table-empty">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <PortalIcon name="team" className="h-7 w-7" />
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              No MS Team members yet. Click "Add Member" to grant report-publishing
              access to a GHS internal user.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: `${totalWidth}px` }}>
              <div
                className="data-table-header grid"
                style={{ gridTemplateColumns: gridTemplate }}
              >
                {TEAM_COLS.map((col, i) => (
                  <div key={col.id} className="data-table-header-cell relative select-none">
                    {col.label}
                    {i < TEAM_COLS.length - 1 && (
                      <div
                        className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize hover:bg-muted"
                        onMouseDown={(e) => startResize(col.id, e)}
                      />
                    )}
                  </div>
                ))}
              </div>
              {members.map((m) => (
                <div
                  key={m.auth0_user_id}
                  className="data-table-row grid"
                  style={{ gridTemplateColumns: gridTemplate }}
                >
                  <div className="data-table-cell overflow-hidden text-sm text-foreground">{m.email}</div>
                  <div className="data-table-cell flex items-center justify-end">
                    <Button
                      type="button"
                      onClick={() => setRemoveTarget(m)}
                      variant="destructive"
                      size="sm"
                      className="whitespace-nowrap"
                    >
                      <Trash2 data-icon="inline-start" />
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Member Dialog */}
      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) {
            setAddName("");
            setAddEmail("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add MS Team Member</DialogTitle>
            <DialogDescription>
              Grants report-publishing access to a GHS internal user. They receive
              the same setup email as client users to choose a password, then sign
              in with the MS Team role.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddSubmit} className="mt-4 space-y-5">
            <div>
              <label className="field-label mb-2 block">Name</label>
              <input
                className="field-input"
                type="text"
                placeholder="Jane Doe"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="field-label mb-2 block">GHS Email</label>
              <input
                className="field-input"
                type="email"
                placeholder="jane@ghsystems.com"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                required
              />
            </div>

            <DialogFooter>
              <DialogClose className="rounded-full border border-border px-5 py-2.5 text-sm text-foreground transition hover:border-border hover:bg-muted">
                Cancel
              </DialogClose>
              <Button
                type="submit"
                disabled={addSubmitting}
              >
                {addSubmitting ? "Adding..." : "Add Member"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation Dialog */}
      <Dialog
        open={!!removeTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRemoveTarget(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove MS Team Member</DialogTitle>
            <DialogDescription>
              This will immediately remove {removeTarget?.email}'s report-publishing
              access and portal role.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <DialogClose className="rounded-full border border-border px-5 py-2.5 text-sm text-foreground transition hover:border-border hover:bg-muted">
              Cancel
            </DialogClose>
            <Button
              type="button"
              onClick={handleRemove}
              disabled={removeSubmitting}
              variant="destructive"
            >
              {removeSubmitting ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
