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

    const body = await readJson(req);
    const action = body.action;
    const email = String(body.email ?? "").trim().toLowerCase();

    if (!email || (action !== "add" && action !== "remove")) {
      throw new HttpError(400, "email and action ('add' or 'remove') are required");
    }

    const { data: existing } = await sb
      .from("profiles")
      .select("auth0_user_id, email, role")
      .eq("email", email)
      .maybeSingle();

    if (action === "add") {
      if (existing) {
        await assertCanManageTarget(sb, caller, existing);
        const { error } = await sb
          .from("profiles")
          .update({ role: "ghs_ms_team" })
          .eq("auth0_user_id", existing.auth0_user_id);
        if (error) throw new HttpError(500, "Failed to update the user's role");
      } else {
        const { error } = await sb.from("profiles").insert({
          auth0_user_id: `pending|${email}`,
          email,
          role: "ghs_ms_team",
        });
        if (error) throw new HttpError(500, "Failed to add the MS Team member");
      }
    } else {
      if (!existing) return json(req, { success: true });
      await assertCanManageTarget(sb, caller, existing);
      if (existing.role !== "ghs_ms_team") {
        throw new HttpError(400, "User is not currently an MS Team member");
      }

      // Placeholder rows were never real accounts, so removing one can just delete
      // it. A provisioned account is deactivated instead of deleted — hard-deleting
      // the profile destroyed the record that audit entries refer back to.
      if (existing.auth0_user_id.startsWith("pending|")) {
        const { error } = await sb
          .from("profiles")
          .delete()
          .eq("auth0_user_id", existing.auth0_user_id);
        if (error) throw new HttpError(500, "Failed to remove the MS Team member");
      } else {
        const { error } = await sb
          .from("profiles")
          .update({ role: "client_user", is_active: false })
          .eq("auth0_user_id", existing.auth0_user_id);
        if (error) throw new HttpError(500, "Failed to remove the MS Team member");
      }
    }

    await writeAuditLog(sb, {
      admin_user_id: caller.auth0_user_id,
      admin_email: caller.email,
      action_type: action === "add" ? "add_ms_team_member" : "remove_ms_team_member",
      target_type: "user",
      target_label: email,
      details: action === "add" ? "Added to GHS MS Team" : "Removed from GHS MS Team",
    });

    return json(req, { success: true });
  } catch (err) {
    return errorResponse(req, err);
  }
}
