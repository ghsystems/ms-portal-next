# Security model

## Data access

The browser never talks to Supabase. Every read and write goes through this app's
API routes (`app/api/*` → `functions/*`), which authenticate the caller's Auth0
token and then use the Supabase **service role** key.

This is deliberate. Supabase cannot validate an Auth0 JWT, so a browser request
carrying an Auth0 token arrives as the anonymous role — which is why the RLS
policies were originally permissive enough to expose the `clients` table to the
public internet. With all access server-side, `anon` and `authenticated` need no
privileges, and `supabase/001_lock_down_rls.sql` removes them.

## Request pipeline

`shared/http.js` is the single entry point for every endpoint:

1. `requireMethod` — each route file exports only the verbs its handler accepts.
2. `authenticate(req, roles)` — verifies the RS256 token against Auth0's JWKS,
   loads the caller's profile, rejects deactivated accounts, and enforces the
   role allowlist. Denied attempts are written to `audit_logs` with
   `outcome: "failure"`.
3. `assertCanManageTarget` — for actions against another user's account. Only a
   super admin may modify a super admin; destructive actions refuse self-targeting.
4. `errorResponse` — only `HttpError` messages reach the client. Everything else
   is logged server-side and returned as a generic 500.

## Token verification

`shared/verify-jwt.js` fails closed. A missing `AUTH0_AUDIENCE` or `AUTH0_DOMAIN`
throws rather than skipping the check, `exp` must be present, `nbf` is honoured,
and only `RS256` is accepted. JWKS is cached for an hour per process, with a
refetch when an unknown `kid` appears.

## Audit trail

Audit entries are written only by the endpoint performing the action, using the
service role. There is no client-callable write path, and the SQL migration adds
a trigger making `audit_logs` append-only. Both successes and denials are recorded.

## CORS

No `Access-Control-Allow-Origin` is emitted unless the request's `Origin` appears
in `PORTAL_ALLOWED_ORIGINS`. The portal calls its own API same-origin, so this is
normally unset.

## Attachments

`shared/servicenow.js` enforces an extension **allowlist** plus per-file (50 MB)
and total (150 MB) limits. `lib/attachments.ts` mirrors it for UX only. Files are
forwarded to ServiceNow without malware scanning — see Known gaps.

## Checks

```
npm run check:security   # JWT fail-closed behaviour + attachment allowlist
npm run build            # type check + lint
```

## Known gaps

- **Attachments are not malware-scanned** before reaching ServiceNow. The
  allowlist blocks executable *extensions*, not malicious content.
- **`check-account-status` is unauthenticated** by necessity (it runs pre-login).
  It is throttled to 15 requests per IP per 15 minutes; an attacker distributing
  probes across many IPs can still enumerate account states.
- **CSP allows `unsafe-inline`/`unsafe-eval`** for scripts, which is what the
  Next.js runtime needs without a nonce-injecting middleware.
- **No automated dependency scanning** in CI (there is no CI).

## Operational requirements

- `supabase/001_lock_down_rls.sql` must be run for RLS lockdown, the
  `api_rate_limits` table, and `login_failures.resolved_at`. Rate limiting and
  lockout tracking degrade open until it is applied.
- Secrets belong in the Vercel project, not in a synced folder. Anything that has
  lived in a local `.env.local` should be treated as exposed and rotated.
