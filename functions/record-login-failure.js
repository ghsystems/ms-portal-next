import { errorResponse, HttpError, json, preflight, readJson, requireMethod, serviceClient } from "../shared/http.js";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_IP = 20;

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight(req);

  try {
    requireMethod(req, "POST");

    const { email } = await readJson(req);
    if (!email || typeof email !== "string" || email.length > 320) {
      throw new HttpError(400, "email is required");
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const sb = serviceClient();

    const cutoff = new Date(Date.now() - WINDOW_MS).toISOString();
    const { count } = await sb
      .from("login_failures")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", cutoff);

    if ((count ?? 0) >= MAX_PER_IP) {
      return json(req, { ok: false }, 429);
    }

    await sb.from("login_failures").insert({ email: email.trim().toLowerCase(), ip });

    return json(req, { ok: true });
  } catch (err) {
    return errorResponse(req, err);
  }
}
