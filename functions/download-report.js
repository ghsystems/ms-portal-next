import {
  authenticate,
  corsHeaders,
  errorResponse,
  HttpError,
  preflight,
  requireMethod,
} from "../shared/http.js";
import { writeAuditLog } from "../shared/audit-log.js";
import { getGraphToken, getSharePointDownloadUrl } from "../shared/graph.js";

const PUBLISH_ROLES = ["ghs_ms_team", "ghs_portal_admin", "ghs_super_admin"];
const METHODS = "GET, OPTIONS";

// Content-Disposition is a header, so a title carrying quotes, CR/LF or non-latin1
// characters can't go in verbatim. RFC 5987 filename* carries the real name.
function contentDisposition(filename) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "'");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight(req, METHODS);

  try {
    requireMethod(req, "GET");
    const { profile, sb } = await authenticate(req);

    const id = new URL(req.url).searchParams.get("id");
    if (!id) throw new HttpError(400, "id is required");

    const { data: report } = await sb
      .from("reports")
      .select("id, title, client_id, sharepoint_item_id, sharepoint_drive_id, is_published")
      .eq("id", id)
      .maybeSingle();

    if (!report || !report.is_published) throw new HttpError(404, "Report not found");

    const isAdmin = PUBLISH_ROLES.includes(profile.role);
    if (!isAdmin && profile.client_id !== report.client_id) {
      await writeAuditLog(sb, {
        admin_user_id: profile.auth0_user_id,
        admin_email: profile.email,
        action_type: "access_denied",
        target_type: "report",
        target_id: report.id,
        target_label: report.title,
        details: "Attempted to download a report belonging to another client",
        outcome: "failure",
      });
      throw new HttpError(403, "Access denied");
    }

    const graphToken = await getGraphToken();
    const { downloadUrl, name } = await getSharePointDownloadUrl(
      graphToken,
      report.sharepoint_drive_id,
      report.sharepoint_item_id,
    );

    // Proxy the file so clients never see SharePoint URLs and download is forced
    const fileResp = await fetch(downloadUrl);
    if (!fileResp.ok) throw new Error("Failed to fetch file from SharePoint");

    const fileBuffer = await fileResp.arrayBuffer();

    await writeAuditLog(sb, {
      admin_user_id: profile.auth0_user_id,
      admin_email: profile.email,
      action_type: "download_report",
      target_type: "report",
      target_id: report.id,
      target_label: report.title,
      details: "Report downloaded",
    });

    return new Response(fileBuffer, {
      headers: {
        ...corsHeaders(req, METHODS),
        "Content-Type": fileResp.headers.get("content-type") ?? "application/octet-stream",
        "Content-Disposition": contentDisposition(report.title || name),
        "Content-Length": String(fileBuffer.byteLength),
      },
    });
  } catch (err) {
    return errorResponse(req, err, METHODS);
  }
}
