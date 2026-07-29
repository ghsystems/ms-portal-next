import { authenticate, errorResponse, HttpError, json, preflight, requireMethod } from "../shared/http.js";
import { getToken } from "../shared/graph.js";

const ALLOWED_ROLES = ["ghs_ms_team", "ghs_portal_admin", "ghs_super_admin"];
const METHODS = "GET, OPTIONS";

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight(req, METHODS);

  try {
    requireMethod(req, "GET");
    await authenticate(req, ALLOWED_ROLES);

    const siteUrl = process.env.GRAPH_SHAREPOINT_SITE_URL;
    if (!siteUrl) throw new HttpError(503, "SharePoint is not configured");
    const baseUrl = new URL(siteUrl).origin;

    // The SharePoint file picker asks for a token per resource. The requested
    // resource used to be taken straight from the query string and turned into a
    // scope, which let any caller mint an app-only token for anything this app
    // registration can reach. Only the two resources the picker actually needs
    // are issuable, and the SharePoint one is pinned to our own tenant host.
    const requested = new URL(req.url).searchParams.get("resource");
    const normalized = requested?.replace(/\/+$/, "") ?? null;

    const allowedResources = [baseUrl, "https://graph.microsoft.com"];
    if (normalized && !allowedResources.includes(normalized)) {
      throw new HttpError(400, "Unsupported resource");
    }

    const token = await getToken(`${normalized ?? "https://graph.microsoft.com"}/.default`);

    return json(req, { token, baseUrl, siteUrl }, 200, METHODS);
  } catch (err) {
    return errorResponse(req, err, METHODS);
  }
}
