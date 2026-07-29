import { useEffect, useState, useCallback } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { API_BASE_URL } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

const P1_COLS = [
  { id: "email", label: "Email" },
  { id: "company", label: "Company" },
  { id: "status", label: "Account Status" },
];

type P1User = {
  auth0_user_id: string;
  email: string;
  is_active: boolean | null;
  clients?: { name: string } | null;
};

function P1AccessTableSkeleton() {
  return (
    <div className="space-y-3 p-8" role="status" aria-label="Loading P1 access">
      {[...Array(4)].map((_, index) => (
        <div key={index} className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-4 w-64 max-w-full" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
      ))}
      <span className="sr-only">Loading P1 access</span>
    </div>
  );
}

export default function P1AccessView() {
  const { getAccessTokenSilently } = useAuth0();
  const [users, setUsers] = useState<P1User[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const token = await getAccessTokenSilently();
      const resp = await fetch(`${API_BASE_URL}/list-users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (resp.ok) {
        const { users: all } = await resp.json();
        const p1Users = (
          all as Array<{ role: string; p1_authorized: boolean | null } & P1User>
        ).filter((u) => u.role === "client_user" && u.p1_authorized === true);
        setUsers(p1Users);
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

  const activeCount = users.filter((u) => u.is_active !== false).length;

  return (
    <>
      <div>
        <h1 className="font-display text-4xl font-light text-foreground tracking-normal">P1 Access</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Client users currently authorized to submit Critical Incident (P1) tickets.
          Manage authorization from the{" "}
          <a href="/admin/users" className="font-medium text-foreground underline underline-offset-2 hover:text-foreground">
            Users
          </a>{" "}
          page.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-border bg-card/40 p-6 shadow-lg shadow-black/5 backdrop-blur-2xl backdrop-saturate-50">
          <p className="text-sm font-bold uppercase tracking-wider text-foreground">
            P1-Authorized Users
          </p>
          {loading ? (
            <Skeleton className="mt-3 h-10 w-16" />
          ) : (
            <p className="mt-2 font-display text-4xl text-foreground">
              {users.length}
            </p>
          )}
        </div>
        <div className="rounded-3xl border border-border bg-card/40 p-6 shadow-lg shadow-black/5 backdrop-blur-2xl backdrop-saturate-50">
          <p className="text-sm font-bold uppercase tracking-wider text-foreground">
            Active Accounts
          </p>
          {loading ? (
            <Skeleton className="mt-3 h-10 w-16" />
          ) : (
            <p className="mt-2 font-display text-4xl text-foreground">
              {activeCount}
            </p>
          )}
        </div>
      </div>

      <div className="data-table-shell mt-6">
        {loading ? (
          <P1AccessTableSkeleton />
        ) : users.length === 0 ? (
          <div className="data-table-empty">
            <p className="text-sm text-muted-foreground">
              No P1-authorized users yet. Enable P1 access for individual users from
              the Users page.
            </p>
          </div>
        ) : (
          <div>
            <div className="data-table-header grid grid-cols-3">
              {P1_COLS.map((col) => (
                <div key={col.id} className="data-table-header-cell select-none text-center">
                  {col.label}
                </div>
              ))}
            </div>
            {users.map((u) => (
              <div
                key={u.auth0_user_id}
                className="data-table-row grid grid-cols-3"
              >
                <div className="data-table-cell overflow-hidden text-sm text-foreground">{u.email}</div>
                <div className="data-table-cell overflow-hidden text-sm text-muted-foreground">{u.clients?.name ?? "-"}</div>
                <div className="data-table-cell">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      u.is_active !== false
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {u.is_active !== false ? "Active" : "Deactivated"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
