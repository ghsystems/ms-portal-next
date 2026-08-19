# Authentication and Authorization

## Authentication Flow

1. `app/providers.tsx` wraps the app with `Auth0Provider`.
2. Unauthenticated users on `/` are sent to Auth0 with `loginWithRedirect`.
3. Auth0 returns to the app.
4. `useProfile` calls `getAccessTokenSilently`.
5. `useProfile` calls `/api/profile` with the bearer token.
6. The server verifies the token in `shared/verify-jwt.js`.
7. The server loads the caller's Supabase profile by Auth0 `sub`.
8. UI routes redirect based on profile role and active status.

## Server JWT Verification

`shared/verify-jwt.js` verifies Auth0 RS256 tokens manually with Web Crypto:

- Fetches Auth0 JWKS and caches signing keys for 1 hour.
- Requires `AUTH0_DOMAIN`.
- Requires `AUTH0_AUDIENCE`.
- Rejects malformed JWTs.
- Rejects non-RS256 algorithms.
- Verifies signature.
- Checks `exp`, optional `nbf`, issuer, subject, and audience.

Important: missing `AUTH0_AUDIENCE` fails closed. Do not make the audience optional.

## Profile Loading

`shared/http.js` has `authenticate(req, roles, options)`.

It:

- Reads `Authorization: Bearer <token>`.
- Verifies the JWT.
- Uses the Supabase service role client.
- Loads `profiles` by `auth0_user_id`.
- Rejects inactive accounts unless `allowInactive` is set.
- Checks allowed roles when passed.
- Writes failed role checks to `audit_logs`.

`/api/profile` passes `allowInactive: true` so the UI can route deactivated users to `/deactivated` rather than showing a generic unauthorized state.

## Role Rules

Defined roles:

- `client_user`
- `ghs_ms_team`
- `ghs_portal_admin`
- `ghs_super_admin`

Client portal layout allows only `client_user`.

Admin layout allows:

- `ghs_ms_team`
- `ghs_portal_admin`
- `ghs_super_admin`

Individual admin pages or API handlers tighten access where needed. For example, MS Team users can publish/list reports but should not manage users or support settings.

## Admin Target Protection

`assertCanManageTarget` in `shared/http.js` prevents unsafe account actions:

- A normal portal admin cannot modify a super admin.
- Destructive self-targeting can be blocked with `allowSelf: false`.
- Denied attempts are written to the audit log.

This matters for deactivate/reactivate, unlock, invite/reinvite, MS Team membership, and P1 authorization flows.

## Public/Unauthenticated Endpoints

Most endpoints require a bearer token. The exceptions are intentional:

- `check-account-status` - Used before login. It checks whether an account is unknown, deactivated, or locked. It is rate-limited by IP.
- `record-login-failure` - Used around login failure handling to support lockout tracking.
- `site-settings?public=1` - Returns only the support email for pre-auth error pages.

Treat these as the most sensitive attack surface because they can be called before authentication.

## Auth0 Management API Usage

The server uses Auth0 Management API for:

- Creating invited users.
- Sending password reset/setup email.
- Blocking/unblocking users.
- Reading user lockout status.

`shared/auth0.js` caches the machine-to-machine token per server process.

## Common Auth Problems

- User exists in Auth0 but not Supabase: `/api/profile` returns unauthorized.
- Profile has wrong `role`: root page redirects to the wrong area.
- Profile has `is_active = false`: user is sent to `/deactivated`.
- Auth0 account is blocked but Supabase says active: login/account status may still block the user.
- Audience mismatch: all authenticated API calls return 401.
