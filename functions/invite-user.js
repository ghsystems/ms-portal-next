import {
  ADMIN_ROLES,
  assertCanManageTarget,
  authenticate,
  errorResponse,
  HttpError,
  json,
  preflight,
  readJson,
  requireMethod,
} from "../shared/http.js";
import { writeAuditLog } from "../shared/audit-log.js";
import { getAuth0ManagementToken } from "../shared/auth0.js";

// Only these two roles are invite-able via the email/password setup flow.
// Admin roles are assigned by other means, not self-service invites.
const INVITE_ROLES = ["client_user", "ghs_ms_team"];

function generatePassword() {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  const rand = new Uint8Array(32);
  crypto.getRandomValues(rand);
  return Array.from(rand, (b) => chars[b % chars.length]).join("");
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight(req);

  try {
    requireMethod(req, "POST");
    const { profile: caller, sb } = await authenticate(req, ADMIN_ROLES);

    const body = await readJson(req);
    const { name, client_id, role = "client_user" } = body;

    if (!INVITE_ROLES.includes(role)) throw new HttpError(400, "Invalid role");

    // Normalised here because profile lookups elsewhere (check-account-status)
    // lowercase too — mixed casing used to create parallel profiles for one person.
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpError(400, "A valid email is required");
    }
    if (role === "client_user" && !client_id) {
      throw new HttpError(400, "client_id is required for client users");
    }

    // Re-inviting an existing address used to upsert the profile with the role and
    // client_id from the request body, so a portal admin could demote the super
    // admin and fire a password-reset at them in one call.
    const { data: existingProfile } = await sb
      .from("profiles")
      .select("auth0_user_id, email, role")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile) {
      await assertCanManageTarget(sb, caller, existingProfile);
      if (!INVITE_ROLES.includes(existingProfile.role)) {
        throw new HttpError(
          409,
          "That address already belongs to an administrator. Change their role first.",
        );
      }
    }

    const displayName = name || email;
    const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
    const mgmtToken = await getAuth0ManagementToken();

    const createResp = await fetch(`https://${AUTH0_DOMAIN}/api/v2/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mgmtToken}`,
      },
      body: JSON.stringify({
        email,
        name: displayName,
        connection: "Username-Password-Authentication",
        password: generatePassword(),
        email_verified: true,
        verify_email: false,
      }),
    });

    let auth0User;

    if (createResp.ok) {
      auth0User = await createResp.json();
    } else {
      if (createResp.status !== 409) {
        console.error("[invite-user] Auth0 create failed:", await createResp.text());
        throw new HttpError(502, "Failed to create the user in Auth0");
      }

      const searchResp = await fetch(
        `https://${AUTH0_DOMAIN}/api/v2/users-by-email?email=${encodeURIComponent(email)}`,
        { headers: { Authorization: `Bearer ${mgmtToken}` } },
      );
      if (!searchResp.ok) {
        throw new HttpError(502, "User already exists in Auth0 but could not be retrieved");
      }

      const matches = await searchResp.json();
      const existing = matches.find((u) => u.user_id.startsWith("auth0|"));
      if (!existing) {
        throw new HttpError(
          409,
          "User already exists in Auth0 but has no username-password account. " +
            "Delete the Auth0 user before re-inviting.",
        );
      }
      auth0User = existing;
    }

    await fetch(`https://${AUTH0_DOMAIN}/dbconnections/change_password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.AUTH0_CLIENT_ID,
        email,
        connection: "Username-Password-Authentication",
      }),
    });

    const { error: upsertError } = await sb.from("profiles").upsert(
      {
        auth0_user_id: auth0User.user_id,
        email,
        role,
        client_id: role === "client_user" ? client_id : null,
      },
      { onConflict: "auth0_user_id" },
    );

    if (upsertError) {
      console.error("[invite-user] profile upsert failed:", upsertError.message);
      throw new HttpError(500, "Failed to save the user profile");
    }

    await writeAuditLog(sb, {
      admin_user_id: caller.auth0_user_id,
      admin_email: caller.email,
      action_type: role === "ghs_ms_team" ? "add_ms_team_member" : "invite_user",
      target_type: "user",
      target_id: auth0User.user_id,
      target_label: email,
      details:
        role === "ghs_ms_team"
          ? "Invited as GHS MS Team member"
          : `Invited as client user for client ${client_id}`,
    });

    return json(req, { success: true });
  } catch (err) {
    return errorResponse(req, err);
  }
}
