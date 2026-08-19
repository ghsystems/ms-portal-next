# Security and Operations

## Security Boundary

The central security boundary is the app's API layer.

Browser:

- Holds Auth0 access token.
- Calls same-origin `/api/*`.
- Performs UX validation only.

Server:

- Verifies Auth0 JWT signature/audience/issuer.
- Loads Supabase profile with service role.
- Authorizes by role and account status.
- Calls external systems with server-side secrets.
- Writes audit logs.

## Security Headers

`next.config.ts` configures:

- Content Security Policy.
- HSTS.
- X-Frame-Options DENY.
- X-Content-Type-Options nosniff.
- Referrer-Policy.
- Permissions-Policy.
- Cross-Origin-Opener-Policy.
- X-DNS-Prefetch-Control off.
- API `Cache-Control: no-store`.
- API `X-Robots-Tag: noindex, nofollow`.

The CSP explicitly allows Auth0, SharePoint, Graph, Microsoft login, Google fonts, and required inline styles/scripts for the current runtime.

## CORS

`shared/http.js` allows cross-origin calls only from `PORTAL_ALLOWED_ORIGINS`.

Same-origin app calls do not need CORS configuration.

## Audit Logging

Audit writes happen server-side through `shared/audit-log.js`.

Examples:

- service request submitted
- P1 incident submitted
- user invited
- user deactivated/reactivated
- user unlocked
- P1 access changed
- MS Team membership changed
- support contacts updated
- report published/downloaded
- maintenance event created/updated/deleted
- access denied events

The Supabase SQL script makes `audit_logs` append-only by refusing updates/deletes.

## Public Endpoint Risk

Public endpoints:

- `/api/check-account-status`
- `/api/record-login-failure`
- `/api/site-settings?public=1`

`check-account-status` is intentionally public because it runs before login. It is rate-limited by IP and avoids returning sensitive data beyond account state messages needed by users.

## Security Check Script

Run:

```bash
npm run check:security
```

It checks:

- attachment allowlist behavior
- blocked dangerous extensions
- path traversal/newline filename rejection
- JWT verification fails closed when Auth0 config is missing
- malformed JWT rejection
- algorithm confusion rejection

Add assertions here when security-critical helpers change.

## Deployment Checklist

Before deployment:

- `npm run lint`
- `npm run check:security`
- `npm run build`
- Confirm production Auth0 callback/logout/web origins.
- Confirm `AUTH0_AUDIENCE` matches `NEXT_PUBLIC_AUTH0_AUDIENCE`.
- Confirm Supabase RLS lockdown script has been applied.
- Confirm service role key is server-only.
- Confirm Graph secret is valid and app permissions have admin consent.
- Confirm ServiceNow credentials and mapping constants.
- Confirm Resend sender/domain.
- Confirm production CSP still matches required external origins.

## Incident Troubleshooting

Authentication failures:

- Check Auth0 tenant/domain and audience.
- Check the user has a Supabase profile with matching `auth0_user_id`.
- Check profile `is_active`.

Ticket failures:

- Check ServiceNow credentials.
- Check ServiceNow field mappings.
- Check attachment size/type.
- Check client mapping.

Report failures:

- Check Graph credentials.
- Check SharePoint site URL.
- Check report row SharePoint ids.
- Check caller client/role.

Admin action failures:

- Check caller role.
- Check whether target is a super admin.
- Check Auth0 Management API token/permissions.
- Check audit log for access denied entries.
