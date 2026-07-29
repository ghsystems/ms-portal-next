import { createClient } from "@supabase/supabase-js";
import { verifyAuth0JWT } from "./verify-jwt.js";
import { writeAuditLog } from "./audit-log.js";

// The portal calls its own API same-origin (NEXT_PUBLIC_API_BASE_URL=/api), so no
// cross-origin access is needed by default. Set PORTAL_ALLOWED_ORIGINS (comma
// separated) only if a genuinely separate front-end origin has to call this API.
const ALLOWED_ORIGINS = (process.env.PORTAL_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);

export function corsHeaders(req, methods = "POST, OPTIONS") {
  const origin = req.headers.get("Origin");
  const headers = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
  };
  if (origin && ALLOWED_ORIGINS.includes(origin.replace(/\/+$/, ""))) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export function json(req, body, status = 200, methods) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req, methods), "Content-Type": "application/json" },
  });
}

export function preflight(req, methods) {
  return new Response(null, { status: 204, headers: corsHeaders(req, methods) });
}

/** Error whose message is safe to show the caller. Anything else becomes a generic 500. */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Maps a thrown value to a response. Only HttpError messages reach the client;
 * everything else is logged server-side and returned as a generic 500 so Supabase,
 * Auth0 and ServiceNow internals aren't leaked to callers.
 */
export function errorResponse(req, err, methods) {
  if (err instanceof HttpError) {
    return json(req, { error: err.message }, err.status, methods);
  }
  console.error("[api] unhandled error:", err);
  return json(req, { error: "Internal error" }, 500, methods);
}

export function serviceClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function requireMethod(req, method) {
  if (req.method !== method) throw new HttpError(405, "Method not allowed");
}

/**
 * Verifies the bearer token and loads the caller's portal profile.
 * `roles` (when given) is the set of roles allowed to call the endpoint.
 * Denied attempts are written to audit_logs with outcome "failure" so that
 * unauthorized access attempts are evidenced, not just successful ones.
 */
export async function authenticate(req, roles, { allowInactive = false } = {}) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new HttpError(401, "Unauthorized");

  let payload;
  try {
    payload = await verifyAuth0JWT(
      authHeader.slice(7).trim(),
      process.env.AUTH0_DOMAIN,
      process.env.AUTH0_AUDIENCE,
    );
  } catch (err) {
    console.error("[api] JWT rejected:", err instanceof Error ? err.message : err);
    throw new HttpError(401, "Unauthorized");
  }

  const sb = serviceClient();
  const { data: profile } = await sb
    .from("profiles")
    .select("auth0_user_id, email, role, client_id, is_active, p1_authorized")
    .eq("auth0_user_id", payload.sub)
    .maybeSingle();

  if (!profile) throw new HttpError(401, "Unauthorized");
  // /profile passes allowInactive so the app can route a deactivated user to the
  // "your access has been deactivated" page instead of a bare 403.
  if (!allowInactive && profile.is_active === false) {
    throw new HttpError(403, "Account is deactivated");
  }

  if (roles && !roles.includes(profile.role)) {
    await writeAuditLog(sb, {
      admin_user_id: payload.sub,
      admin_email: profile.email,
      action_type: "access_denied",
      target_type: "endpoint",
      target_label: new URL(req.url).pathname,
      details: `Role ${profile.role} is not permitted to call this endpoint`,
      outcome: "failure",
    });
    throw new HttpError(403, "Forbidden");
  }

  return { payload, profile, sb };
}

export const ADMIN_ROLES = ["ghs_portal_admin", "ghs_super_admin"];

/**
 * Guards actions taken against another user's account. A ghs_portal_admin could
 * previously deactivate, demote, or force a password reset on the ghs_super_admin;
 * only a super admin may act on a super admin. Self-targeting is refused for
 * destructive actions so an admin can't lock themselves out.
 */
export async function assertCanManageTarget(sb, caller, target, { allowSelf = true } = {}) {
  if (!target) throw new HttpError(404, "User not found");

  const denied =
    (target.role === "ghs_super_admin" && caller.role !== "ghs_super_admin") ||
    (!allowSelf && target.auth0_user_id === caller.auth0_user_id);

  if (denied) {
    await writeAuditLog(sb, {
      admin_user_id: caller.auth0_user_id,
      admin_email: caller.email,
      action_type: "access_denied",
      target_type: "user",
      target_label: target.email ?? null,
      details:
        target.role === "ghs_super_admin"
          ? "Attempted to modify a Super Admin account"
          : "Attempted a self-targeted account action",
      outcome: "failure",
    });
    throw new HttpError(
      403,
      target.role === "ghs_super_admin"
        ? "Only a Super Admin can modify a Super Admin account"
        : "You cannot perform this action on your own account",
    );
  }
}

export async function readJson(req) {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
}
