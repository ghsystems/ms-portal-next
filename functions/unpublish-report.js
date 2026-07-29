import {
  authenticate,
  errorResponse,
  HttpError,
  json,
  preflight,
  readJson,
  requireMethod,
} from "../shared/http.js";
import { writeAuditLog } from "../shared/audit-log.js";

const ALLOWED_ROLES = ["ghs_ms_team", "ghs_portal_admin", "ghs_super_admin"];

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight(req);

  try {
    requireMethod(req, "POST");
    const { profile, sb } = await authenticate(req, ALLOWED_ROLES);

    // ponytail: doubles as republish via { publish: true } rather than a second near-identical endpoint
    const { id, publish = false } = await readJson(req);
    if (!id) throw new HttpError(400, "id is required");
    if (typeof publish !== "boolean") throw new HttpError(400, "publish must be a boolean");

    const { data: report } = await sb
      .from("reports")
      .select("id, title, is_published")
      .eq("id", id)
      .maybeSingle();

    if (!report) throw new HttpError(404, "Report not found");
    if (Boolean(report.is_published) === publish) {
      throw new HttpError(400, `Report is already ${publish ? "published" : "unpublished"}`);
    }

    const { error } = await sb.from("reports").update({ is_published: publish }).eq("id", id);
    if (error) {
      console.error("[unpublish-report] update failed:", error.message);
      throw new HttpError(500, "Failed to update the report");
    }

    await writeAuditLog(sb, {
      admin_user_id: profile.auth0_user_id,
      admin_email: profile.email,
      action_type: publish ? "publish_report" : "unpublish_report",
      target_type: "report",
      target_id: report.id,
      target_label: report.title,
      details: publish ? "Restored to client view" : "Removed from client view",
    });

    return json(req, { success: true });
  } catch (err) {
    return errorResponse(req, err);
  }
}
