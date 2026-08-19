# Final Handover Checklist

Use this before the coop term ends.

## Access to Hand Over

- Auth0 tenant access.
- Auth0 app/API configuration.
- Auth0 Management API machine-to-machine app.
- Supabase project access.
- Vercel or deployment platform access.
- ServiceNow integration account details.
- Microsoft Entra app registration access.
- SharePoint report library/site access.
- Resend account or sender/domain access.

Do not put secrets in documentation. Hand over through the approved password/secret manager.

## Production Configuration to Confirm

- Auth0 callback URLs.
- Auth0 logout URLs.
- Auth0 allowed web origins.
- Auth0 API audience.
- Supabase URL and service role key in deployment environment.
- ServiceNow instance URL and credential validity.
- Graph tenant/client/secret and SharePoint site URL.
- Resend key and from email.
- `PORTAL_ALLOWED_ORIGINS` if any separate frontend origin exists.

## Database Items to Confirm

- `profiles` rows exist for current admins.
- At least one `ghs_super_admin` exists.
- Client users have correct `client_id`.
- Clients have correct names and, where possible, `servicenow_company_sys_id`.
- `reports` rows point to valid SharePoint item/drive ids.
- `site_settings` has `support_contacts`.
- `maintenance_events` old/test data is cleaned up.
- `audit_logs` append-only trigger exists.
- RLS lockdown script has been applied.
- Retention job/process exists for login failures and API rate limits.

## Code Health Checks

Run:

```bash
npm run lint
npm run check:security
npm run build
```

Document any failure with:

- command run
- error output summary
- likely owner/system
- next action

## Manual Smoke Test

Client user:

- Login.
- See dashboard.
- Submit a normal request.
- Confirm ServiceNow ticket number appears.
- Upload a valid attachment.
- Try a blocked attachment type.
- Open tickets list.
- Open a ticket detail.
- Download a published report.
- Dismiss and re-login to test maintenance banner behavior.

P1-authorized client user:

- Submit a P1 incident.
- Confirm P1 ticket in ServiceNow.
- Confirm audit log entry.

Portal admin:

- List users.
- Invite a test client user.
- Deactivate/reactivate a test user.
- Unlock a test user.
- Grant/revoke P1 access.
- Add/remove MS Team test user.
- Update support contacts.
- Create/edit/delete a maintenance event.
- View audit logs.

MS Team user:

- Confirm only Reports is visible in admin nav.
- Browse SharePoint files.
- Publish a report.
- Confirm client can see/download it.

## Known Follow-Ups Worth Reviewing

- Confirm ServiceNow state, impact, urgency, and priority mappings against the production instance.
- Replace fallback `correlation_id = client.name` ticket scoping with real `servicenow_company_sys_id` values for every client.
- Decide whether `Invoice` should be a real report type. It exists in client-side types but is not allowed by the publish API.
- Confirm the hard-coded ServiceNow caller sys_id is the intended production caller.
- Review CSP if stricter nonce-based script policy is required later.
- Confirm transient data retention is scheduled.

## Where to Look First

- Auth/routing issue: `app/page.tsx`, `hooks/useProfile.ts`, `shared/http.js`, `shared/verify-jwt.js`.
- Ticket issue: `functions/submit-service-request.js`, `functions/list-tickets.js`, `shared/servicenow.js`.
- Report issue: `functions/publish-report.js`, `functions/download-report.js`, `shared/graph.js`.
- User admin issue: `functions/list-users.js`, `functions/invite-user.js`, `functions/deactivate-user.js`, `functions/unlock-user.js`.
- Maintenance/support issue: `functions/maintenance-events.js`, `functions/site-settings.js`.
- Audit issue: `shared/audit-log.js`, `functions/audit-logs.js`, Supabase `audit_logs` table.
