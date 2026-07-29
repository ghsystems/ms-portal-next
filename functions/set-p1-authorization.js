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

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight(req);

  try {
    requireMethod(req, "POST");
    const { profile: caller, sb } = await authenticate(req, ADMIN_ROLES);

    const { auth0_user_id, p1_authorized } = await readJson(req);
    if (!auth0_user_id || typeof p1_authorized !== "boolean") {
      throw new HttpError(400, "auth0_user_id and p1_authorized (boolean) are required");
    }

    const { data: target } = await sb
      .from("profiles")
      .select("auth0_user_id, email, role")
      .eq("auth0_user_id", auth0_user_id)
      .maybeSingle();

    await assertCanManageTarget(sb, caller, target);

    const { error } = await sb
      .from("profiles")
      .update({ p1_authorized })
      .eq("auth0_user_id", auth0_user_id);

    if (error) {
      console.error("[set-p1-authorization] update failed:", error.message);
      throw new HttpError(500, "Failed to update P1 authorization");
    }

    await writeAuditLog(sb, {
      admin_user_id: caller.auth0_user_id,
      admin_email: caller.email,
      action_type: "set_p1_authorization",
      target_type: "user",
      target_id: auth0_user_id,
      target_label: target.email ?? null,
      details: p1_authorized ? "P1 access enabled" : "P1 access disabled",
    });

    return json(req, { success: true });
  } catch (err) {
    return errorResponse(req, err);
  }
}
