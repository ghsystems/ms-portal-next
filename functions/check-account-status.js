import { errorResponse, HttpError, json, preflight, readJson, requireMethod, serviceClient } from "../shared/http.js";

// This endpoint is intentionally unauthenticated — it runs before login, so the
// caller has no token yet. That makes it the app's only anonymous attack surface,
// so it is throttled hard by IP before it touches Auth0.
//
// ponytail: residual risk accepted — an attacker who can spread probes across many
// IPs can still distinguish "no account" from "locked/deactivated". Removing the
// distinction entirely would leave genuinely locked-out users with no explanation,
// and returning ok:true for unknown emails would let the passwordless OTP flow
// auto-create accounts. Throttling is the trade-off; revisit if probing shows up
// in the logs.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PROBES_PER_IP = 15;

function clientIp(req) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/**
 * Returns true when the caller is over budget. A database problem here logs and
 * allows the request through: this sits in front of login, and failing closed on
 * an infrastructure hiccup would lock every user out of the portal.
 */
async function isRateLimited(sb, ip, endpoint) {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  try {
    const { count, error } = await sb
      .from("api_rate_limits")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .eq("endpoint", endpoint)
      .gte("created_at", since);
    if (error) throw new Error(error.message);

    if ((count ?? 0) >= MAX_PROBES_PER_IP) return true;

    await sb.from("api_rate_limits").insert({ ip, endpoint });
    return false;
  } catch (err) {
    console.error("[rate-limit] check failed, allowing request:", err);
    return false;
  }
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight(req);

  try {
    requireMethod(req, "POST");

    const { email } = await readJson(req);
    if (!email || typeof email !== "string") {
      throw new HttpError(400, "email is required");
    }

    const normalizedEmail = email.trim().toLowerCase();
    const ip = clientIp(req);
    const sb = serviceClient();

    if (await isRateLimited(sb, ip, "check-account-status")) {
      return json(req, { ok: false, message: "Too many attempts. Please try again later." }, 429);
    }

    const { data: profile } = await sb
      .from("profiles")
      .select("auth0_user_id, is_active")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (!profile) {
      // No portal account. Reject rather than letting the OTP passwordless flow
      // auto-create a brand-new user. Generic message so the form doesn't confirm
      // whether an account exists (matches the password flow's wording).
      return json(req, { ok: false, message: "Wrong email or password." });
    }

    if (profile.is_active === false) {
      return json(req, {
        ok: false,
        message: "This account has been deactivated. Please contact GHS support.",
      });
    }

    const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
    const tokenResp = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: process.env.AUTH0_M2M_CLIENT_ID,
        client_secret: process.env.AUTH0_M2M_CLIENT_SECRET,
        audience: `https://${AUTH0_DOMAIN}/api/v2/`,
      }),
    });

    if (!tokenResp.ok) {
      console.error("[check-account-status] Auth0 management token request failed");
      return json(req, { ok: true });
    }

    const { access_token: mgmtToken } = await tokenResp.json();

    const [userResp, blocksResp] = await Promise.all([
      fetch(
        `https://${AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(profile.auth0_user_id)}`,
        { headers: { Authorization: `Bearer ${mgmtToken}` } },
      ),
      fetch(
        `https://${AUTH0_DOMAIN}/api/v2/user-blocks?identifier=${encodeURIComponent(normalizedEmail)}`,
        { headers: { Authorization: `Bearer ${mgmtToken}` } },
      ),
    ]);

    if (userResp.ok) {
      const user = await userResp.json();
      if (user.blocked === true) {
        return json(req, {
          ok: false,
          message: "This account has been deactivated. Please contact GHS support.",
        });
      }
    }

    if (blocksResp.ok) {
      const blocks = await blocksResp.json();
      const blocked = Array.isArray(blocks?.blocked_for)
        ? blocks.blocked_for.length > 0
        : Array.isArray(blocks?.blocks)
          ? blocks.blocks.length > 0
          : false;
      if (blocked) {
        return json(req, {
          ok: false,
          message:
            "Your account is locked after too many failed login attempts. Please contact GHS support to unlock your account.",
        });
      }
    }

    const cutoff = new Date(Date.now() - WINDOW_MS).toISOString();
    const { count } = await sb
      .from("login_failures")
      .select("id", { count: "exact", head: true })
      .eq("email", normalizedEmail)
      .eq("ip", ip)
      .is("resolved_at", null)
      .gte("created_at", cutoff);

    if ((count ?? 0) >= 5) {
      return json(req, {
        ok: false,
        message:
          "Your account is locked after too many failed login attempts. Please contact GHS support to unlock your account.",
      });
    }

    return json(req, { ok: true });
  } catch (err) {
    return errorResponse(req, err);
  }
}
