import { authenticate, errorResponse, json, preflight, requireMethod } from "../shared/http.js";

const METHODS = "GET, OPTIONS";

/**
 * The caller's own profile. Replaces the browser querying `profiles` directly:
 * Supabase can't validate an Auth0 token, so those queries ran as the anonymous
 * role and only worked because RLS was left open on the table.
 */
export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight(req, METHODS);

  try {
    requireMethod(req, "GET");
    const { profile } = await authenticate(req, undefined, { allowInactive: true });
    return json(req, { profile }, 200, METHODS);
  } catch (err) {
    return errorResponse(req, err, METHODS);
  }
}
