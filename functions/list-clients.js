import { authenticate, errorResponse, json, preflight, requireMethod } from "../shared/http.js";

const ALLOWED_ROLES = ["ghs_ms_team", "ghs_portal_admin", "ghs_super_admin"];
const METHODS = "GET, OPTIONS";

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight(req, METHODS);

  try {
    requireMethod(req, "GET");
    const { sb } = await authenticate(req, ALLOWED_ROLES);

    const { data: clients, error } = await sb.from("clients").select("id, name").order("name");
    if (error) throw new Error(error.message);

    return json(req, { clients: clients ?? [] }, 200, METHODS);
  } catch (err) {
    return errorResponse(req, err, METHODS);
  }
}
