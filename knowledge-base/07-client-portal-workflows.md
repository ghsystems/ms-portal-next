# Client Portal Workflows

## Portal Shell

`components/portal/portal-shell.tsx` renders the client portal header, navigation, profile menu, logout, maintenance banner, and page container.

Client routes:

- `/portal`
- `/portal/new-request`
- `/portal/tickets`
- `/portal/reports`

The portal idle timeout is 60 minutes. On timeout/logout, dismissed maintenance events are cleared so active banners can reappear on the next login.

## Portal State

`components/portal/portal-context.tsx` provides shared portal state:

- caller profile
- display name and company
- ticket list
- ticket stats
- recent activity
- loading/error state
- `refetchTickets`
- `addTicket`

Tickets are polled every 60 seconds and refreshed on window focus.

## Dashboard

`views/dashboard-view.tsx` is the main client landing page. It uses portal context for ticket metrics and recent activity, includes support/contact information, and exposes quick request/P1 actions.

Dashboard defaults service request impact and urgency to Medium when using the embedded form.

## New Request

`views/new-request-view.tsx` renders the full request flow using `components/portal/service-request-form.tsx`.

Fields:

- Request type: Incident, Change Request, Service Request.
- Subject.
- Description, minimum 50 characters.
- Impact.
- Urgency.
- Calculated priority.
- Optional attachments.

Client-side validation helps UX, but server-side validation in `functions/submit-service-request.js` is authoritative.

## Attachment Rules

Limits are mirrored in `lib/attachments.ts` and `shared/servicenow.js`.

- 50 MB per file.
- 150 MB total.
- Allowed extensions include common Office, PDF, text/log, image, archive, email, JSON/XML/YAML formats.
- Disallowed filenames with path separators or control characters.

If the allowlist changes, update both files and run:

```bash
npm run check:security
```

## P1 Critical Incidents

P1 submission is handled through `components/portal/p1-incident-dialog.tsx` and `/api/submit-p1-incident`.

Rules:

- Caller must be authenticated.
- Caller profile must have `p1_authorized = true`.
- Incident is created as ServiceNow impact `1` and urgency `1`.
- Subject is prefixed with `[P1 CRITICAL]`.
- A confirmation email is attempted if Resend is configured.
- Action is audit logged.

## Tickets

`views/tickets-view.tsx` lists tickets from ServiceNow through `lib/tickets.ts` and `/api/list-tickets`.

Features include:

- Filtering/sorting.
- Resizable columns.
- Ticket details.
- ServiceNow public comments as activity log.

ServiceNow is the source of truth. After submitting a new request, `PortalProvider.addTicket` shows an optimistic local ticket, then reloads from ServiceNow.

## Reports

`views/reports-view.tsx` shows client-visible published reports from `/api/list-reports`.

Clients only see:

- `is_published = true`
- matching `client_id`

Downloads go through `/api/download-report` so the server can enforce authorization and proxy SharePoint file content.
