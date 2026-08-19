# Data Model and Supabase

## Supabase Role in This App

Supabase stores portal metadata, not the primary ticket files. Tickets live in ServiceNow. Report files live in SharePoint. Supabase stores the profile, client, report metadata, support settings, maintenance events, lockout tracking, rate limiting, and audit log.

The browser should not query Supabase directly. API handlers use `SUPABASE_SERVICE_ROLE_KEY` after Auth0 token verification.

## Tables Used by the App

### `profiles`

Used for authentication and authorization.

Important fields referenced by code:

- `auth0_user_id`
- `email`
- `role`
- `client_id`
- `is_active`
- `p1_authorized`
- `created_at`

Notes:

- `auth0_user_id` must match the Auth0 token `sub`.
- `client_user` profiles should have `client_id`.
- MS Team users generally have `client_id = null`.
- `p1_authorized` controls access to `/api/submit-p1-incident`.

### `clients`

Used for client scoping and report/ticket mapping.

Important fields:

- `id`
- `name`
- `servicenow_company_sys_id`

Ticket listing prefers `servicenow_company_sys_id` when it is a valid 32-character ServiceNow sys_id. If not available, the code falls back to the client name stored in ServiceNow `correlation_id` when the ticket was created.

### `reports`

Report metadata stored in Supabase. File content stays in SharePoint.

Important fields:

- `id`
- `title`
- `type`
- `report_date`
- `client_id`
- `sharepoint_item_id`
- `sharepoint_drive_id`
- `is_published`
- `published_by_user_id`
- `published_by_email`
- `created_at`

Client users only see published reports for their own `client_id`. Admin/MS Team users can see reports across clients.

### `site_settings`

Stores JSON settings by key.

Current key:

- `support_contacts`

The public pre-auth API exposes only `managedServicesEmail`.

### `maintenance_events`

Stores maintenance/banner events.

Important fields:

- `id`
- `title`
- `message`
- `type`
- `starts_at`
- `ends_at`
- `all_clients`
- `created_by`

### `maintenance_event_clients`

Join table for maintenance events targeted to specific clients.

Important fields:

- `event_id`
- `client_id`

### `audit_logs`

Append-only audit trail written by server handlers.

Important fields:

- `id`
- `admin_user_id`
- `admin_email`
- `action_type`
- `target_type`
- `target_id`
- `target_label`
- `details`
- `outcome`
- `created_at`

Most writes default to `outcome = "success"`. Denied or failed attempts pass `outcome = "failure"`.

### `login_failures`

Tracks login failures and lockout support.

Important fields:

- `email`
- `ip`
- `created_at`
- `resolved_at`

Unlocking a user marks failures as resolved instead of deleting history.

### `api_rate_limits`

Tracks anonymous endpoint probes by IP.

Important fields:

- `ip`
- `endpoint`
- `created_at`

Used by `check-account-status`.

## RLS Lockdown

See `supabase/001_lock_down_rls.sql`.

That script:

- Creates/updates `api_rate_limits`.
- Adds `login_failures.resolved_at`.
- Enables and forces RLS on portal tables.
- Drops existing policies.
- Revokes table access from `anon` and `authenticated`.
- Adds a trigger preventing `audit_logs` update/delete.
- Documents suggested retention cleanup for transient tables.

Reason: Supabase cannot validate the Auth0 JWT used by the frontend. Direct browser access arrives as the Supabase anonymous role, so the app moved all Supabase access behind verified server API calls.

## Data Retention Notes

The SQL file recommends purging:

- `login_failures` older than 90 days.
- `api_rate_limits` older than 7 days.

This can be scheduled with `pg_cron` or another maintenance process.
