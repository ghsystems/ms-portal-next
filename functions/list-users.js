import {
  ADMIN_ROLES,
  authenticate,
  errorResponse,
  json,
  preflight,
  requireMethod,
} from "../shared/http.js";
import { getAuth0ManagementToken } from "../shared/auth0.js";

const METHODS = "GET, OPTIONS";
const WINDOW_MS = 15 * 60 * 1000;

function hasAuth0Blocks(blocks) {
  if (!blocks || typeof blocks !== "object") return false;
  if (Array.isArray(blocks.blocked_for)) return blocks.blocked_for.length > 0;
  if (Array.isArray(blocks.blocks)) return blocks.blocks.length > 0;
  return Object.keys(blocks).length > 0;
}

async function getAuth0LockStatus(profiles) {
  const lockStatus = {};
  const candidates = profiles.filter(
    (p) => (p.role === "client_user" || p.role === "ghs_ms_team") && p.is_active !== false && p.email,
  );
  if (candidates.length === 0) return lockStatus;

  try {
    const mgmtToken = await getAuth0ManagementToken();
    await Promise.all(
      candidates.map(async (profile) => {
        const resp = await fetch(
          `https://${process.env.AUTH0_DOMAIN}/api/v2/user-blocks?identifier=${encodeURIComponent(profile.email)}`,
          { headers: { Authorization: `Bearer ${mgmtToken}` } },
        );
        lockStatus[profile.email] = resp.ok ? hasAuth0Blocks(await resp.json()) : false;
      }),
    );
  } catch (err) {
    // Keep the user listing available even if Auth0 lock status can't be read.
    console.error("[list-users] Auth0 lock status unavailable:", err);
  }

  return lockStatus;
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight(req, METHODS);

  try {
    requireMethod(req, "GET");
    const { sb } = await authenticate(req, ADMIN_ROLES);

    const [profilesResult, clientsResult] = await Promise.all([
      sb
        .from("profiles")
        .select("auth0_user_id, email, role, client_id, is_active, p1_authorized, created_at")
        .order("email"),
      sb.from("clients").select("id, name"),
    ]);

    if (profilesResult.error) {
      console.error("[list-users] profile query failed:", profilesResult.error.message);
      throw new Error(profilesResult.error.message);
    }

    const profiles = profilesResult.data ?? [];
    const cutoff = new Date(Date.now() - WINDOW_MS).toISOString();

    const [auth0LockedByEmail, failuresResult] = await Promise.all([
      getAuth0LockStatus(profiles),
      sb.from("login_failures").select("email").is("resolved_at", null).gte("created_at", cutoff),
    ]);

    const failureCount = {};
    for (const row of failuresResult.data ?? []) {
      failureCount[row.email] = (failureCount[row.email] ?? 0) + 1;
    }

    const clientMap = Object.fromEntries((clientsResult.data ?? []).map((c) => [c.id, c.name]));

    const users = profiles.map((p) => ({
      ...p,
      auth0_locked: (auth0LockedByEmail[p.email] ?? false) || (failureCount[p.email] ?? 0) >= 5,
      clients: p.client_id ? { name: clientMap[p.client_id] ?? null } : null,
    }));

    return json(req, { users }, 200, METHODS);
  } catch (err) {
    return errorResponse(req, err, METHODS);
  }
}
