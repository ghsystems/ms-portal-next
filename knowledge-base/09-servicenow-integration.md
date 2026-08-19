# ServiceNow Integration

## Purpose

ServiceNow is the source of truth for client tickets and incidents.

The integration lives in:

- `shared/servicenow.js`
- `functions/submit-service-request.js`
- `functions/submit-p1-incident.js`
- `functions/list-tickets.js`

## Credentials

Required environment variables:

- `SERVICENOW_INSTANCE_URL`
- `SERVICENOW_USERNAME`
- `SERVICENOW_PASSWORD`

The app uses Basic Auth through `getServiceNowCredentials`.

## Creating Service Requests

`/api/submit-service-request` creates a ServiceNow incident with:

- `short_description` from the portal subject.
- `description` containing request type, requester identity, impact/urgency/priority, and description.
- `category` from request type.
- `subcategory` from portal category. Currently the request form sends `General`.
- `impact` and `urgency` mapped by `SNOW_LEVEL`.
- `caller_id` set to a constant ServiceNow user sys_id.
- `correlation_id` set to the Supabase client name when available.

Requester email comes from the verified profile, not the browser request body.

## Creating P1 Incidents

`/api/submit-p1-incident` creates an incident with:

- subject prefixed by `[P1 CRITICAL]`
- impact `1`
- urgency `1`
- description marked as production-down critical incident
- same requester/profile protections as service requests

The caller must have `p1_authorized = true`.

## Attachments

Attachment upload is best-effort. If a ticket is created but one or more attachments fail, the API returns `attachmentError` but does not roll back the incident.

Server-side rules:

- File extension allowlist.
- No path separators or control characters in file names.
- 50 MB per file.
- 150 MB total.
- Raw base64 body is decoded and sent to ServiceNow attachment API.

## Listing Tickets

`/api/list-tickets` queries ServiceNow incidents and maps them into portal ticket objects.

Client scoping:

- If `clients.servicenow_company_sys_id` is a valid 32-character sys_id, query by ServiceNow company.
- Otherwise, query by `correlation_id = client.name`.
- Also includes tickets where `caller_id.email = profile.email`.

The code validates encoded query values to avoid widening ServiceNow filters.

## Ticket Detail and Activity

When `sys_id` is passed to `/api/list-tickets`, the API:

- Ensures the requested sys_id is valid.
- Confirms it was part of the scoped query result.
- Fetches ServiceNow `sys_journal_field` records where `element=comments`.
- Returns comments oldest-first as portal activity log.

Internal work notes are not returned.

## Mapping Caveats

`shared/servicenow.js` includes comments noting that ServiceNow impact, urgency, priority, and state values may differ by instance. Confirm these mappings with the production ServiceNow configuration:

- `SNOW_LEVEL`
- `SNOW_LEVEL_REVERSE`
- `SNOW_STATE_TO_PORTAL_STATUS`

The current code maps ServiceNow states to Open, In Progress, and Resolved.
