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
const VALID_TYPES = [
  "Monthly Managed Services Report",
  "Major Incident Report",
  "Annual SOC 2 Report",
];

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight(req);

  try {
    requireMethod(req, "POST");
    const { profile, sb } = await authenticate(req, ALLOWED_ROLES);

    const { title, type, reportDate, clientId, sharepointItemId, sharepointDriveId } =
      await readJson(req);

    if (!title?.trim()) throw new HttpError(400, "title is required");
    if (!VALID_TYPES.includes(type)) throw new HttpError(400, "Invalid report type");
    if (!reportDate || !/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
      throw new HttpError(400, "reportDate must be YYYY-MM-DD");
    }
    if (!clientId) throw new HttpError(400, "clientId is required");
    if (!sharepointItemId || !sharepointDriveId) {
      throw new HttpError(400, "sharepointItemId and sharepointDriveId are required");
    }

    const { data: client } = await sb
      .from("clients")
      .select("id, name")
      .eq("id", clientId)
      .maybeSingle();
    if (!client) throw new HttpError(400, "Client not found");

    const { data: report, error } = await sb
      .from("reports")
      .insert({
        title: title.trim(),
        type,
        report_date: reportDate,
        client_id: clientId,
        sharepoint_item_id: sharepointItemId,
        sharepoint_drive_id: sharepointDriveId,
        is_published: true,
        published_by_user_id: profile.auth0_user_id,
        published_by_email: profile.email,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[publish-report] insert failed:", error.message);
      throw new HttpError(500, "Failed to publish the report");
    }

    await writeAuditLog(sb, {
      admin_user_id: profile.auth0_user_id,
      admin_email: profile.email,
      action_type: "publish_report",
      target_type: "report",
      target_id: report.id,
      target_label: title.trim(),
      details: `Published to ${client.name} — ${type}`,
    });

    return json(req, { report });
  } catch (err) {
    return errorResponse(req, err);
  }
}
