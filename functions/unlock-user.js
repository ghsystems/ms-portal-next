import {
  ADMIN_ROLES,
  assertCanManageTarget,
  authenticate,
  errorResponse,
  HttpError,
  json,
  preflight,
  readJson,
  requireMethod,
} from "../shared/http.js";
import { writeAuditLog } from "../shared/audit-log.js";
import { getAuth0ManagementToken } from "../shared/auth0.js";

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight(req);

  try {
    requireMethod(req, "POST");
    const { profile: caller, sb } = await authenticate(req, ADMIN_ROLES);

    const { auth0_user_id } = await readJson(req);
    if (!auth0_user_id) throw new HttpError(400, "auth0_user_id is required");

    const { data: target } = await sb
      .from("profiles")
      .select("auth0_user_id, email, role, is_active")
      .eq("auth0_user_id", auth0_user_id)
      .maybeSingle();

    await assertCanManageTarget(sb, caller, target);
    if (!target.email) throw new HttpError(404, "User profile not found");
    if (target.is_active === false) {
      throw new HttpError(409, "Reactivate this user before clearing login lockout.");
    }

    const mgmtToken = await getAuth0ManagementToken();

    const unblockResp = await fetch(
      `https://${process.env.AUTH0_DOMAIN}/api/v2/user-blocks?identifier=${encodeURIComponent(target.email)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${mgmtToken}` } },
    );

    if (!unblockResp.ok && unblockResp.status !== 404) {
      console.error("[unlock-user] Auth0 unblock failed:", await unblockResp.text());
      throw new HttpError(502, "Failed to unlock the user in Auth0");
    }

    // Mark the failures resolved rather than deleting them — the lockout history
    // is evidence, and purging it on unlock left no trace of the attempts.
    await sb
      .from("login_failures")
      .update({ resolved_at: new Date().toISOString() })
      .eq("email", target.email)
      .is("resolved_at", null);

    await writeAuditLog(sb, {
      admin_user_id: caller.auth0_user_id,
      admin_email: caller.email,
      action_type: "unlock_user",
      target_type: "user",
      target_id: auth0_user_id,
      target_label: target.email,
      details: "Login lockout cleared",
    });

    return json(req, { success: true });
  } catch (err) {
    return errorResponse(req, err);
  }
}
