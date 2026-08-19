# API and Server Functions

## Pattern

Each endpoint has two pieces:

- `app/api/<endpoint>/route.js` - Thin Next.js route export.
- `functions/<endpoint>.js` - Actual handler.

Most handlers use helpers from `shared/http.js`:

- `authenticate`
- `requireMethod`
- `readJson`
- `json`
- `preflight`
- `errorResponse`
- `HttpError`
- `serviceClient`

## Endpoint Summary

### Profile and Account

- `GET /api/profile` -> `functions/profile.js`
  - Authenticated.
  - Returns caller profile.
  - Allows inactive profile lookup so UI can show the deactivated page.

- `POST /api/check-account-status` -> `functions/check-account-status.js`
  - Public by design.
  - Used before login.
  - Rate-limited by IP.
  - Checks Supabase profile, Auth0 blocked state, Auth0 user-blocks, and recent unresolved login failures.

- `POST /api/record-login-failure` -> `functions/record-login-failure.js`
  - Public by design.
  - Stores email/IP failure event with per-IP limit.

### ServiceNow Tickets

- `POST /api/submit-service-request` -> `functions/submit-service-request.js`
  - Authenticated portal user.
  - Validates request fields and attachments.
  - Creates ServiceNow incident.
  - Uploads attachments best-effort.
  - Sends confirmation email best-effort.
  - Writes audit log.

- `POST /api/submit-p1-incident` -> `functions/submit-p1-incident.js`
  - Authenticated.
  - Requires `profile.p1_authorized`.
  - Creates highest-impact/highest-urgency ServiceNow incident.
  - Uploads attachments and sends email best-effort.
  - Writes audit log.

- `GET /api/list-tickets` -> `functions/list-tickets.js`
  - Authenticated.
  - Requires assigned client.
  - Reads ServiceNow incidents by company/caller filter.
  - Optional `sys_id` query returns detail with public comments.

### Reports and SharePoint

- `GET /api/list-reports` -> `functions/list-reports.js`
  - Authenticated.
  - Admin/MS Team users see all reports.
  - Client users see only published reports for their client.

- `POST /api/publish-report` -> `functions/publish-report.js`
  - Roles: `ghs_ms_team`, `ghs_portal_admin`, `ghs_super_admin`.
  - Creates published report metadata pointing at SharePoint item/drive ids.
  - Writes audit log.

- `POST /api/unpublish-report` -> `functions/unpublish-report.js`
  - Removes/unpublishes a report. Check implementation before changing behavior.

- `GET /api/download-report?id=<id>` -> `functions/download-report.js`
  - Authenticated.
  - Enforces client ownership unless admin/MS Team.
  - Gets SharePoint download URL server-side.
  - Proxies file content so users do not receive direct SharePoint URLs.
  - Writes audit log.

- `GET /api/list-sharepoint-files` -> `functions/list-sharepoint-files.js`
  - Roles: `ghs_ms_team`, `ghs_portal_admin`, `ghs_super_admin`.
  - Optional `itemId` browses a SharePoint folder.
  - Validates Graph item id shape.

- `GET /api/graph-picker-token` -> `functions/graph-picker-token.js`
  - Used by report publishing/file picker support.

### Admin Users

- `GET /api/list-users` -> `functions/list-users.js`
  - Admin roles.
  - Returns profiles, client names, and lock status.

- `POST /api/invite-user` -> `functions/invite-user.js`
  - Admin roles.
  - Invites `client_user` or `ghs_ms_team`.
  - Creates or finds Auth0 database user.
  - Sends Auth0 password reset/setup email.
  - Upserts Supabase profile.
  - Writes audit log.

- `POST /api/deactivate-user` -> `functions/deactivate-user.js`
  - Admin roles.
  - Blocks/unblocks Auth0 user and updates `profiles.is_active`.
  - Blocks unsafe self/super-admin target changes.
  - Writes audit log.

- `POST /api/unlock-user` -> `functions/unlock-user.js`
  - Admin roles.
  - Clears Auth0 user-blocks and marks local login failures resolved.
  - Writes audit log.

- `POST /api/set-ms-team-role` -> `functions/set-ms-team-role.js`
  - Admin roles.
  - Adds/removes MS Team membership.
  - Existing provisioned users are deactivated rather than hard-deleted when removed.
  - Writes audit log.

- `POST /api/set-p1-authorization` -> `functions/set-p1-authorization.js`
  - Admin roles.
  - Updates `profiles.p1_authorized`.
  - Writes audit log.

### Settings, Maintenance, Audit

- `GET/PUT /api/site-settings` -> `functions/site-settings.js`
  - Public mode: `GET ?public=1` returns support email only.
  - Authenticated GET returns full support contact details.
  - Admin PUT updates support contact details and writes audit log.

- `GET/POST/PATCH/DELETE /api/maintenance-events` -> `functions/maintenance-events.js`
  - Authenticated GET.
  - Admin-only writes.
  - Client users only receive events targeted to them or all clients.
  - Writes audit log for changes.

- `GET /api/audit-logs` -> `functions/audit-logs.js`
  - Admin roles.
  - Read-only paginated audit log with filters.

- `GET /api/list-clients` -> `functions/list-clients.js`
  - Roles: `ghs_ms_team`, `ghs_portal_admin`, `ghs_super_admin`.
  - Used by admin report publishing and maintenance targeting.

## Error Handling

Use `HttpError(status, message)` only for messages safe to show callers. Other thrown errors are logged server-side and returned as generic `Internal error`.

## CORS and Cache Headers

`next.config.ts` adds security headers globally and `no-store` headers for `/api/*`.

`shared/http.js` only allows CORS origins listed in `PORTAL_ALLOWED_ORIGINS`. Same-origin calls work without that variable.
