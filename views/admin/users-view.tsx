import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useResizableCols } from "@/hooks/useResizableCols";

const USER_COLS = [
  { id: "email" as const, label: "Email", width: 300, minWidth: 180 },
  { id: "company" as const, label: "Company", width: 200, minWidth: 120 },
  { id: "role" as const, label: "Role", width: 140, minWidth: 80 },
  { id: "p1" as const, label: "P1 Auth", width: 96, minWidth: 64 },
  { id: "status" as const, label: "Status", width: 130, minWidth: 80 },
  { id: "actions" as const, label: "Actions", width: 180, minWidth: 120 },
];
import { useAuth0 } from "@auth0/auth0-react";
import { API_BASE_URL, apiFetch } from "@/lib/api";
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
import { PortalIcon } from "@/components/portal/portal-ui";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

type Client = { id: string; name: string };

type Profile = {
  auth0_user_id: string;
  email: string;
  role: string;
  client_id: string;
  is_active: boolean | null;
  p1_authorized: boolean | null;
  auth0_locked?: boolean | null;
  clients?: { name: string } | null;
};

type InviteForm = { name: string; email: string; client_id: string };
const emptyInviteForm: InviteForm = { name: "", email: "", client_id: "" };

type SortKey = "email" | "company" | "role" | "status";
type SortDir = "asc" | "desc";
type FilterKey = "status" | "p1" | "role" | "company";
type Filters = {
  status: string[];
  p1: string[];
  role: string[];
  company: string[];
};
const emptyFilters: Filters = { status: [], p1: [], role: [], company: [] };

const roleLabel: Record<string, string> = {
  client_user: "Client User",
  ghs_portal_admin: "Portal Admin",
  ghs_ms_team: "MS Team",
  ghs_super_admin: "Super Admin",
};

function isActive(u: Profile) {
  return u.is_active !== false;
}

function isP1(u: Profile) {
  return u.p1_authorized === true;
}

function UsersTableSkeleton() {
  return (
    <div className="space-y-3 p-8" role="status" aria-label="Loading users">
      {[...Array(6)].map((_, index) => (
        <div key={index} className="flex items-center gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-64 max-w-full" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
      ))}
      <span className="sr-only">Loading users</span>
    </div>
  );
}

// GHS-internal roles (MS Team, admins) aren't tied to a client company.
function companyLabel(u: Profile) {
  if (u.role !== "client_user") return "GlassHouse Systems";
  return u.clients?.name ?? "No company";
}

// Client users and MS Team members can be deactivated / have lockouts cleared
// from here. Admins/super admins are intentionally left out.
function hasUserActions(u: Profile) {
  return u.role === "client_user" || u.role === "ghs_ms_team";
}

function statusLabel(u: Profile) {
  if (!isActive(u)) return "Deactivated";
  if (u.auth0_locked === true) return "Locked";
  return "Active";
}

const statusBadgeConfig: Record<
  string,
  { bg: string; text: string; dot: string; label: string }
> = {
  Active: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
    label: "Active",
  },
  Locked: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
    label: "Locked",
  },
  Deactivated: {
    bg: "bg-muted",
    text: "text-muted-foreground",
    dot: "bg-muted",
    label: "Inactive",
  },
};

function UserStatusBadge({ value }: { value: string }) {
  const c = statusBadgeConfig[value] ?? statusBadgeConfig.Deactivated;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wider",
        c.bg,
        c.text,
      )}
    >
      {c.label}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const elevated = role !== "client_user";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold",
        elevated
          ? "bg-muted text-foreground"
          : "bg-muted text-muted-foreground",
      )}
    >
      {roleLabel[role] ?? role}
    </span>
  );
}

function P1Badge({
  enabled,
  applicable,
}: {
  enabled: boolean;
  applicable: boolean;
}) {
  if (!applicable) return <span className="text-muted-foreground">-</span>;
  return enabled ? (
    <span className="inline-flex items-center rounded-md bg-amber-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-amber-800">
      Yes
    </span>
  ) : (
    <span className="inline-flex items-center rounded-md bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
      No
    </span>
  );
}

export default function UsersView() {
  const { startResize, gridTemplate, totalWidth } = useResizableCols(USER_COLS);
  const { getAccessTokenSilently } = useAuth0();
  const [users, setUsers] = useState<Profile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const filterBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openFilter) return;
    function handleOutside(e: MouseEvent) {
      if (
        filterBarRef.current &&
        !filterBarRef.current.contains(e.target as Node)
      ) {
        setOpenFilter(null);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [openFilter]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("email");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{
    top: number;
    right: number;
  } | null>(null);

  // Add user dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteForm>(emptyInviteForm);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // Deactivate / reactivate dialog
  const [actionTarget, setActionTarget] = useState<{
    profile: Profile;
    action: "deactivate" | "reactivate" | "unlock";
  } | null>(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // P1 authorization dialog
  const [p1Target, setP1Target] = useState<{
    profile: Profile;
    enable: boolean;
  } | null>(null);
  const [p1Submitting, setP1Submitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const token = await getAccessTokenSilently();

      const [{ users }, { clients }] = await Promise.all([
        apiFetch<{ users: Profile[] }>("/list-users", token),
        apiFetch<{ clients: { id: string; name: string }[] }>("/list-clients", token),
      ]);

      setUsers(users);
      setClients(clients);
    } catch {
      // network error - leave lists empty
    } finally {
      setLoading(false);
    }
  }, [getAccessTokenSilently]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function renderSortHeader(key: SortKey, label: string) {
    return (
      <button
        type="button"
        onClick={() => handleSort(key)}
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        {label}
        <span className="text-[10px]">
          {sortKey === key ? (sortDir === "asc" ? "Asc" : "Desc") : "-"}
        </span>
      </button>
    );
  }

  function toggleFilterValue(key: FilterKey, value: string) {
    setFilters((f) => {
      const cur = f[key];
      const next = cur.includes(value)
        ? cur.filter((v) => v !== value)
        : [...cur, value];
      return { ...f, [key]: next };
    });
  }

  function clearFilters() {
    setSearch("");
    setFilters(emptyFilters);
    setOpenFilter(null);
  }

  const hasActiveFilters =
    search !== "" ||
    filters.status.length > 0 ||
    filters.p1.length > 0 ||
    filters.role.length > 0 ||
    filters.company.length > 0;

  const roleOptions = useMemo(
    () => Array.from(new Set(users.map((u) => u.role))),
    [users],
  );

  const filterMenus: {
    key: FilterKey;
    label: string;
    options: { value: string; label: string }[];
  }[] = [
    {
      key: "status",
      label: "Status",
      options: [
        { value: "Active", label: "Active" },
        { value: "Locked", label: "Locked" },
        { value: "Deactivated", label: "Inactive" },
      ],
    },
    {
      key: "p1",
      label: "P1 Auth",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
    {
      key: "role",
      label: "Role",
      options: roleOptions.map((r) => ({ value: r, label: roleLabel[r] ?? r })),
    },
    {
      key: "company",
      label: "Company",
      options: clients.map((c) => ({ value: c.id, label: c.name })),
    },
  ];

  const filteredUsers = useMemo(() => {
    const filtered = users.filter((u) => {
      if (search && !u.email.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (filters.status.length && !filters.status.includes(statusLabel(u)))
        return false;
      if (filters.p1.length && !filters.p1.includes(isP1(u) ? "yes" : "no"))
        return false;
      if (filters.role.length && !filters.role.includes(u.role)) return false;
      if (filters.company.length && !filters.company.includes(u.client_id))
        return false;
      return true;
    });

    return filtered.sort((a, b) => {
      let valA = "";
      let valB = "";
      switch (sortKey) {
        case "email":
          valA = a.email;
          valB = b.email;
          break;
        case "company":
          valA = companyLabel(a);
          valB = companyLabel(b);
          break;
        case "role":
          valA = roleLabel[a.role] ?? a.role;
          valB = roleLabel[b.role] ?? b.role;
          break;
        case "status":
          valA = statusLabel(a);
          valB = statusLabel(b);
          break;
      }
      const cmp = valA.localeCompare(valB);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [users, search, filters, sortKey, sortDir]);

  async function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteForm.client_id) {
      toast.error("Select a client company.");
      return;
    }
    setInviteSubmitting(true);
    try {
      const token = await getAccessTokenSilently();
      const resp = await fetch(`${API_BASE_URL}/invite-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(inviteForm),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? "Something went wrong");
      setInviteSuccess(true);
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setInviteSubmitting(false);
    }
  }

  function handleInviteOpenChange(open: boolean) {
    setInviteOpen(open);
    if (!open) {
      setInviteForm(emptyInviteForm);
      setInviteSuccess(false);
    }
  }

  async function handleAction() {
    if (!actionTarget) return;
    setActionSuccess(null);
    setActionSubmitting(true);
    try {
      const token = await getAccessTokenSilently();
      const endpoint =
        actionTarget.action === "unlock" ? "unlock-user" : "deactivate-user";
      const resp = await fetch(`${API_BASE_URL}/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          auth0_user_id: actionTarget.profile.auth0_user_id,
          action: actionTarget.action,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? "Something went wrong");
      if (actionTarget.action === "unlock") {
        setActionSuccess(
          `${actionTarget.profile.email} can try signing in again. If the account was not locked, no account settings were changed.`,
        );
      }
      setActionTarget(null);
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setActionSubmitting(false);
    }
  }

  async function handleP1Toggle() {
    if (!p1Target) return;
    setP1Submitting(true);
    try {
      const token = await getAccessTokenSilently();
      const resp = await fetch(`${API_BASE_URL}/set-p1-authorization`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          auth0_user_id: p1Target.profile.auth0_user_id,
          p1_authorized: p1Target.enable,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? "Something went wrong");
      toast.success(
        `P1 access ${p1Target.enable ? "enabled" : "removed"} for ${p1Target.profile.email}.`,
      );
      setP1Target(null);
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setP1Submitting(false);
    }
  }

  return (
    <>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-4xl font-light text-foreground tracking-normal">
            Users
          </h1>
        </div>
        <Button
          type="button"
          onClick={() => setInviteOpen(true)}
        >
          <span className="text-base leading-none">+</span>
          Add User
        </Button>
      </div>

      {/* Toolbar: search + filters */}
      <div className="relative z-20 mt-6 rounded-md border border-border bg-background p-3.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex h-11 max-w-md flex-1 items-center gap-2.5 rounded-xl border border-border bg-muted px-3.5">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9aa1a8"
              strokeWidth="2.2"
              strokeLinecap="round"
              className="shrink-0"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              placeholder="Search by email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>

          <div
            ref={filterBarRef}
            className="flex flex-wrap items-center justify-end gap-2"
          >
            {filterMenus.map((menu) => {
              const selected = filters[menu.key];
              const isOpen = openFilter === menu.key;
              const active = selected.length > 0;
              return (
                <div key={menu.key} className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenFilter(isOpen ? null : menu.key)}
                    className={cn(
                      "flex h-11 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 text-sm font-semibold transition",
                      active
                        ? "bg-secondary text-white"
                        : "bg-transparent text-foreground",
                    )}
                  >
                    {active ? `${menu.label} - ${selected.length}` : menu.label}
                    <PortalIcon
                      name="chevronDown"
                      className={cn(
                        "h-3.5 w-3.5",
                        active ? "text-white/60" : "text-muted-foreground",
                      )}
                    />
                  </button>
                  {isOpen && (
                    <div className="absolute right-0 top-[50px] z-40 min-w-[190px] rounded-xl border border-border bg-card p-1.5 shadow-xl">
                      {menu.options.length === 0 ? (
                        <p className="px-2.5 py-2 text-xs text-muted-foreground">
                          No options
                        </p>
                      ) : (
                        menu.options.map((o) => {
                          const checked = selected.includes(o.value);
                          return (
                            <button
                              key={o.value}
                              type="button"
                              onClick={() =>
                                toggleFilterValue(menu.key, o.value)
                              }
                              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-foreground transition hover:bg-muted"
                            >
                              <span
                                className={cn(
                                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                                  checked
                                    ? "border-border bg-secondary"
                                    : "border-border bg-card",
                                )}
                              >
                                {checked && (
                                  <PortalIcon
                                    name="check"
                                    className="h-3 w-3 text-white"
                                  />
                                )}
                              </span>
                              {o.label}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="px-1.5 text-xs font-semibold text-muted-foreground hover:text-muted-foreground"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="data-table-shell mt-6">
        {loading ? (
          <UsersTableSkeleton />
        ) : filteredUsers.length === 0 ? (
          <div className="data-table-empty">
            <p className="text-sm text-foreground">
              {hasActiveFilters
                ? "No users match the current filters."
                : `No users yet. Click "Add User" to invite the first client contact.`}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-2 text-xs font-semibold text-foreground underline-offset-2 hover:text-muted-foreground hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <div style={{ minWidth: `${totalWidth}px` }}>
                <div
                  className="data-table-header grid items-center"
                  style={{ gridTemplateColumns: gridTemplate }}
                >
                  <div className="data-table-header-cell relative">
                    {renderSortHeader("email", "Email")}
                    <div
                      className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize hover:bg-muted"
                      onMouseDown={(e) => startResize("email", e)}
                    />
                  </div>
                  <div className="data-table-header-cell relative">
                    {renderSortHeader("company", "Company")}
                    <div
                      className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize hover:bg-muted"
                      onMouseDown={(e) => startResize("company", e)}
                    />
                  </div>
                  <div className="data-table-header-cell relative">
                    {renderSortHeader("role", "Role")}
                    <div
                      className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize hover:bg-muted"
                      onMouseDown={(e) => startResize("role", e)}
                    />
                  </div>
                  <div className="data-table-header-cell relative">
                    <span>
                      P1 Auth
                    </span>
                    <div
                      className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize hover:bg-muted"
                      onMouseDown={(e) => startResize("p1", e)}
                    />
                  </div>
                  <div className="data-table-header-cell relative">
                    {renderSortHeader("status", "Status")}
                    <div
                      className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize hover:bg-muted"
                      onMouseDown={(e) => startResize("status", e)}
                    />
                  </div>
                  <div className="data-table-header-cell text-right">
                    Actions
                  </div>
                </div>

                {filteredUsers.map((u) => (
                  <div
                    key={u.auth0_user_id}
                    className="data-table-row grid items-center *:p-4"
                    style={{ gridTemplateColumns: gridTemplate }}
                  >
                    <div className="min-w-0">
                      <span className="truncate text-sm font-medium text-foreground">
                        {u.email}
                      </span>
                    </div>
                    <div className="truncate text-sm text-muted-foreground">
                      {companyLabel(u)}
                    </div>
                    <div>
                      <RoleBadge role={u.role} />
                    </div>
                    <div>
                      <P1Badge
                        enabled={isP1(u)}
                        applicable={u.role === "client_user"}
                      />
                    </div>
                    <div>
                      <UserStatusBadge value={statusLabel(u)} />
                    </div>
                    <div className="relative flex items-center justify-end">
                      {hasUserActions(u) && (
                        <>
                          {openActionMenu === u.auth0_user_id && (
                            <div
                              className="fixed inset-0 z-30"
                              onClick={() => setOpenActionMenu(null)}
                            />
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              if (openActionMenu === u.auth0_user_id) {
                                setOpenActionMenu(null);
                              } else {
                                const r =
                                  e.currentTarget.getBoundingClientRect();
                                setMenuAnchor({
                                  top: r.bottom + 4,
                                  right: window.innerWidth - r.right,
                                });
                                setOpenActionMenu(u.auth0_user_id);
                              }
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:border-border hover:bg-muted hover:text-foreground"
                          >
                            ...
                          </button>
                          {openActionMenu === u.auth0_user_id &&
                            menuAnchor &&
                            createPortal(
                              <div
                                className="fixed z-9999 min-w-[160px] border border-border bg-card py-1 shadow-lg"
                                style={{
                                  top: menuAnchor.top,
                                  right: menuAnchor.right,
                                  borderRadius: "10px",
                                }}
                              >
                                {isActive(u) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenu(null);
                                      setActionTarget({
                                        profile: u,
                                        action: "unlock",
                                      });
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-foreground transition hover:bg-muted"
                                  >
                                    Clear Lockout
                                  </button>
                                )}
                                {u.role === "client_user" && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenu(null);
                                      setP1Target({
                                        profile: u,
                                        enable: !isP1(u),
                                      });
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-foreground transition hover:bg-muted"
                                  >
                                    {isP1(u) ? "Remove P1" : "Enable P1"}
                                  </button>
                                )}
                                {isActive(u) ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenu(null);
                                      setActionTarget({
                                        profile: u,
                                        action: "deactivate",
                                      });
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50"
                                  >
                                    Deactivate
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenu(null);
                                      setActionTarget({
                                        profile: u,
                                        action: "reactivate",
                                      });
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-emerald-700 transition hover:bg-emerald-50"
                                  >
                                    Reactivate
                                  </button>
                                )}
                              </div>,
                              document.body,
                            )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border px-6 py-3.5">
              <p className="text-xs font-medium text-muted-foreground">
                {filteredUsers.length === users.length
                  ? `Showing all ${users.length} users`
                  : `Showing ${filteredUsers.length} of ${users.length} users`}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled
                  className="flex h-8 cursor-not-allowed items-center rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground"
                >
                  Previous
                </button>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-xs font-semibold text-white">
                  1
                </span>
                <button
                  type="button"
                  disabled
                  className="flex h-8 cursor-not-allowed items-center rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add User Dialog */}
      <Dialog open={inviteOpen} onOpenChange={handleInviteOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>
              A welcome email has been sent.
            </DialogDescription>
          </DialogHeader>

          {inviteSuccess ? (
            <div className="py-6 text-center">
              <p className="text-sm font-medium text-foreground">
                Invite sent successfully.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {inviteForm.email} will receive a setup email shortly.
              </p>
              <DialogFooter className="mt-6 justify-center">
                <DialogClose className="rounded-full bg-secondary px-6 py-2.5 text-sm text-white hover:bg-accent">
                  Done
                </DialogClose>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleInviteSubmit} className="mt-4 space-y-5">
              <div>
                <label className="field-label mb-2 block">Full Name</label>
                <input
                  className="field-input"
                  type="text"
                  placeholder="Jane Smith"
                  value={inviteForm.name}
                  onChange={(e) =>
                    setInviteForm((f) => ({ ...f, name: e.target.value }))
                  }
                  required
                />
              </div>

              <div>
                <label className="field-label mb-2 block">Email</label>
                <input
                  className="field-input"
                  type="email"
                  placeholder="jane@client.com"
                  value={inviteForm.email}
                  onChange={(e) =>
                    setInviteForm((f) => ({ ...f, email: e.target.value }))
                  }
                  required
                />
              </div>

              <div>
                <label className="field-label mb-2 block">Client Company</label>
                <Select
                  value={inviteForm.client_id}
                  onValueChange={(value) =>
                    setInviteForm((f) => ({ ...f, client_id: (value ?? "") as string }))
                  }
                  items={clients.map((c) => ({ value: c.id, label: c.name }))}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select a company..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <DialogClose className="rounded-full border border-border px-5 py-2.5 text-sm text-foreground transition hover:border-border hover:bg-muted">
                  Cancel
                </DialogClose>
                <Button
                  type="submit"
                  disabled={inviteSubmitting}
                >
                  {inviteSubmitting ? "Sending invite..." : "Send Invite"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Deactivate / Reactivate Confirmation Dialog */}
      <Dialog
        open={!!actionTarget}
        onOpenChange={(open) => {
          if (!open) {
            setActionTarget(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionTarget?.action === "deactivate"
                ? "Deactivate User"
                : actionTarget?.action === "reactivate"
                  ? "Reactivate User"
                  : "Clear Lockout"}
            </DialogTitle>
            <DialogDescription>
              {actionTarget?.action === "deactivate"
                ? `This will immediately block ${actionTarget.profile.email} from logging in. You can reactivate their account at any time.`
                : actionTarget?.action === "reactivate"
                  ? `This will restore portal access for ${actionTarget?.profile.email}.`
                  : `This will clear any failed-login lockout for ${actionTarget?.profile.email}. If the account is not currently locked, no account settings will change.`}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <DialogClose className="rounded-full border border-border px-5 py-2.5 text-sm text-foreground transition hover:border-border hover:bg-muted">
              Cancel
            </DialogClose>
            <Button
              type="button"
              onClick={handleAction}
              disabled={actionSubmitting}
              variant={actionTarget?.action === "deactivate" ? "destructive" : "default"}
            >
              {actionSubmitting
                ? "Processing..."
                : actionTarget?.action === "deactivate"
                  ? "Deactivate"
                  : actionTarget?.action === "reactivate"
                    ? "Reactivate"
                    : "Clear Lockout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!actionSuccess}
        onOpenChange={(open) => {
          if (!open) setActionSuccess(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Lockout Cleared</DialogTitle>
            <DialogDescription>{actionSuccess}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose className="rounded-full bg-secondary px-6 py-2.5 text-sm text-white hover:bg-accent">
              Done
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* P1 Authorization Toggle Dialog */}
      <Dialog
        open={!!p1Target}
        onOpenChange={(open) => {
          if (!open) {
            setP1Target(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {p1Target?.enable
                ? "Enable P1 Authorization"
                : "Remove P1 Authorization"}
            </DialogTitle>
            <DialogDescription>
              {p1Target?.enable
                ? `This will allow ${p1Target.profile.email} to submit Critical Incident (P1) tickets from the client portal.`
                : `This will remove ${p1Target?.profile.email}'s ability to submit Critical Incident (P1) tickets.`}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <DialogClose className="rounded-full border border-border px-5 py-2.5 text-sm text-foreground transition hover:border-border hover:bg-muted">
              Cancel
            </DialogClose>
            <Button
              type="button"
              onClick={handleP1Toggle}
              disabled={p1Submitting}
              variant={p1Target?.enable ? "secondary" : "default"}
            >
              {p1Submitting
                ? "Saving..."
                : p1Target?.enable
                  ? "Enable P1"
                  : "Remove P1"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
