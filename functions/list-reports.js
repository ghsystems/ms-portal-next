import { authenticate, errorResponse, HttpError, json, preflight, requireMethod } from "../shared/http.js";

const PUBLISH_ROLES = ["ghs_ms_team", "ghs_portal_admin", "ghs_super_admin"];
const METHODS = "GET, OPTIONS";

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight(req, METHODS);

  try {
    requireMethod(req, "GET");
    const { profile, sb } = await authenticate(req);

    const isAdmin = PUBLISH_ROLES.includes(profile.role);

    let query = sb
      .from("reports")
      .select("id, title, type, report_date, client_id, is_published, published_by_email, created_at, clients(name)")
      .order("report_date", { ascending: false });

    if (isAdmin) {
      // admins see all reports (published + unpublished) across all clients
    } else if (profile.role === "client_user") {
      if (!profile.client_id) throw new HttpError(403, "No client assigned");
      query = query.eq("client_id", profile.client_id).eq("is_published", true);
    } else {
      throw new HttpError(403, "Forbidden");
    }

    const { data: reports, error } = await query;
    if (error) throw new Error(error.message);

    return json(req, { reports: reports ?? [], isAdmin }, 200, METHODS);
  } catch (err) {
    return errorResponse(req, err, METHODS);
  }
}
