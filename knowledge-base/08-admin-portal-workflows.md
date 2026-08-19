# Admin Portal Workflows

## Admin Shell

`components/admin/admin-shell.tsx` renders admin navigation, profile menu, logout, and page container.

The admin idle timeout is 30 minutes because admin sessions can change accounts, roles, reports, and settings.

MS Team users only see Reports. Portal admins and super admins see all admin sections.

## Users

`views/admin/users-view.tsx` calls:

- `/api/list-users`
- `/api/list-clients`
- `/api/invite-user`
- `/api/deactivate-user`
- `/api/unlock-user`

Main capabilities:

- View portal profiles and client assignments.
- Sort/filter users.
- Invite client users.
- Deactivate/reactivate accounts.
- Clear login lockouts.

Important safety behavior:

- Normal portal admins cannot modify super admin accounts.
- Destructive self-actions are blocked where needed.
- Auth0 is updated as well as Supabase.
- All changes are audit logged.

## P1 Access

`views/admin/p1-access-view.tsx` manages `profiles.p1_authorized` through `/api/set-p1-authorization`.

Grant this only to client users who should be able to submit production-down critical incidents.

## MS Team

`views/admin/ms-team-view.tsx` manages MS Team membership through `/api/set-ms-team-role`.

Behavior:

- Adding an existing profile changes the role to `ghs_ms_team`.
- Adding a new email can create a pending profile row.
- Removing a pending profile deletes it.
- Removing a real provisioned account changes it back to `client_user` and deactivates it rather than deleting history.

## Reports

`views/admin/admin-reports-view.tsx` lists reports for admin/MS Team users.

`views/admin/admin-reports-publish-view.tsx` publishes SharePoint files as portal reports.

Publishing requires:

- Client.
- Report title.
- Report type.
- Report date.
- SharePoint file item id and drive id.

Allowed report types in the publish API:

- Monthly Managed Services Report
- Major Incident Report
- Annual SOC 2 Report

Note: `components/portal/portal-data.ts` also includes `Invoice` in the client-side `ReportType` union, but `functions/publish-report.js` does not currently allow publishing invoices. Update both places if invoice publishing becomes real.

## Support Contacts

`views/admin/support-contacts-view.tsx` edits support contact details stored under `site_settings.key = support_contacts`.

Public unauthenticated pages can read only the managed services support email. Authenticated users can read the full contact set.

## Maintenance Events

`views/admin/maintenance-events-view.tsx` and `views/admin/maintenance-event-form-view.tsx` manage client maintenance banners.

Admins can:

- Create events.
- Edit events.
- Delete events.
- Target all clients or selected clients.

Client users only receive all-client events or events linked to their `client_id`.

## Audit Log

`views/admin/audit-log-view.tsx` reads `/api/audit-logs`.

The audit log is read-only from the UI. Writes happen server-side inside the endpoint performing the action.

Filters include:

- Date range.
- Action type.
- Admin email.
- Pagination/page size.
