import { authenticate, errorResponse, HttpError, json, preflight, requireMethod } from "../shared/http.js";
import { getGraphToken, getSharePointSiteId, listSharePointFolder } from "../shared/graph.js";

const ALLOWED_ROLES = ["ghs_ms_team", "ghs_portal_admin", "ghs_super_admin"];
const METHODS = "GET, OPTIONS";

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight(req, METHODS);

  try {
    requireMethod(req, "GET");
    await authenticate(req, ALLOWED_ROLES);

    const itemId = new URL(req.url).searchParams.get("itemId") || null;
    // Graph drive item ids are opaque but always alphanumeric with a few separators;
    // reject anything else rather than pasting it into a Graph URL path.
    if (itemId && !/^[A-Za-z0-9!._~-]{1,200}$/.test(itemId)) {
      throw new HttpError(400, "Invalid itemId");
    }

    const graphToken = await getGraphToken();
    const siteId = await getSharePointSiteId(graphToken);
    const items = await listSharePointFolder(graphToken, siteId, itemId);

    return json(req, { items }, 200, METHODS);
  } catch (err) {
    return errorResponse(req, err, METHODS);
  }
}
