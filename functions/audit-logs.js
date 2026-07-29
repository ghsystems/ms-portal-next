import { ADMIN_ROLES, authenticate, errorResponse, json, preflight, requireMethod } from "../shared/http.js";

const METHODS = "GET, OPTIONS";
const MAX_PAGE_SIZE = 100;

const FIELDS =
  "id, admin_user_id, admin_email, action_type, target_type, target_id, target_label, details, outcome, created_at";

/**
 * Read-only. Audit entries are written by the endpoints that perform the action,
 * using the service role — there is deliberately no client-callable write path,
 * because a trail the client can append to isn't evidence of anything.
 */
export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight(req, METHODS);

  try {
    requireMethod(req, "GET");
    const { sb } = await authenticate(req, ADMIN_ROLES);

    const params = new URL(req.url).searchParams;
    const pageSize = Math.min(Number(params.get("pageSize")) || 50, MAX_PAGE_SIZE);
    const page = Math.max(Number(params.get("page")) || 0, 0);
    const from = page * pageSize;

    let query = sb
      .from("audit_logs")
      .select(FIELDS, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    const dateFrom = params.get("from");
    const dateTo = params.get("to");
    const actionType = params.get("actionType");
    const adminEmail = params.get("adminEmail");

    if (dateFrom) query = query.gte("created_at", dateFrom);
    if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59Z`);
    if (actionType) query = query.eq("action_type", actionType);
    // Escape PostgREST's LIKE wildcards so a filter value can't widen the match.
    if (adminEmail) query = query.ilike("admin_email", `%${adminEmail.replace(/[%_]/g, "")}%`);

    const { data, count, error } = await query;
    if (error) throw new Error(error.message);

    return json(req, { logs: data ?? [], total: count ?? 0 }, 200, METHODS);
  } catch (err) {
    return errorResponse(req, err, METHODS);
  }
}
