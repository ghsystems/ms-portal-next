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

    const { auth0_user_id, action } = await readJson(req);
    if (!auth0_user_id || !["deactivate", "reactivate"].includes(action)) {
      throw new HttpError(400, "auth0_user_id and action ('deactivate' | 'reactivate') are required");
    }

    const { data: target } = await sb
      .from("profiles")
      .select("auth0_user_id, email, role")
      .eq("auth0_user_id", auth0_user_id)
      .maybeSingle();

    await assertCanManageTarget(sb, caller, target, { allowSelf: false });

    const blocked = action === "deactivate";
    const mgmtToken = await getAuth0ManagementToken();

    const updateResp = await fetch(
      `https://${process.env.AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(auth0_user_id)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${mgmtToken}`,
        },
        body: JSON.stringify({ blocked }),
      },
    );

    if (!updateResp.ok) {
      console.error("[deactivate-user] Auth0 update failed:", await updateResp.text());
      throw new HttpError(502, "Failed to update the user in Auth0");
    }

    await sb.from("profiles").update({ is_active: !blocked }).eq("auth0_user_id", auth0_user_id);

    await writeAuditLog(sb, {
      admin_user_id: caller.auth0_user_id,
      admin_email: caller.email,
      action_type: blocked ? "deactivate_user" : "reactivate_user",
      target_type: "user",
      target_id: auth0_user_id,
      target_label: target.email ?? null,
      details: blocked
        ? "Account deactivated — portal access blocked"
        : "Account reactivated — portal access restored",
    });

    return json(req, { success: true });
  } catch (err) {
    return errorResponse(req, err);
  }
}
