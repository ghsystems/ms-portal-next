import {
  ADMIN_ROLES,
  authenticate,
  errorResponse,
  HttpError,
  json,
  preflight,
  readJson,
  serviceClient,
} from "../shared/http.js";
import { writeAuditLog } from "../shared/audit-log.js";

const METHODS = "GET, PUT, OPTIONS";
const SETTINGS_KEY = "support_contacts";

const FIELDS = [
  "managedServicesEmail",
  "managedServicesPhone",
  "hotlinePhone",
  "escalationManagerName",
  "escalationManagerEmail",
  "escalationManagerPhone",
];

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight(req, METHODS);

  try {
    // The pre-auth error pages need the support email before there is a session,
    // so ?public=1 returns just that one field — not the whole contact record.
    const url = new URL(req.url);
    if (req.method === "GET" && url.searchParams.get("public") === "1") {
      const { data } = await serviceClient()
        .from("site_settings")
        .select("value")
        .eq("key", SETTINGS_KEY)
        .maybeSingle();
      return json(req, { email: data?.value?.managedServicesEmail ?? null }, 200, METHODS);
    }

    if (req.method === "GET") {
      const { sb } = await authenticate(req);
      const { data } = await sb
        .from("site_settings")
        .select("value")
        .eq("key", SETTINGS_KEY)
        .maybeSingle();
      return json(req, { contacts: data?.value ?? null }, 200, METHODS);
    }

    if (req.method !== "PUT") throw new HttpError(405, "Method not allowed");

    const { profile, sb } = await authenticate(req, ADMIN_ROLES);
    const body = await readJson(req);

    const contacts = {};
    for (const field of FIELDS) {
      const value = body?.[field];
      if (typeof value !== "string" || value.length > 200) {
        throw new HttpError(400, `${field} is required`);
      }
      contacts[field] = value.trim();
    }
    for (const field of ["managedServicesEmail", "escalationManagerEmail"]) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contacts[field])) {
        throw new HttpError(400, `${field} must be a valid email address`);
      }
    }

    const { error } = await sb
      .from("site_settings")
      .upsert({ key: SETTINGS_KEY, value: contacts }, { onConflict: "key" });
    if (error) throw new Error(error.message);

    await writeAuditLog(sb, {
      admin_user_id: profile.auth0_user_id,
      admin_email: profile.email,
      action_type: "update_support_contacts",
      target_type: "site_settings",
      target_label: SETTINGS_KEY,
      details: "Support contact details updated",
    });

    return json(req, { success: true }, 200, METHODS);
  } catch (err) {
    return errorResponse(req, err, METHODS);
  }
}
