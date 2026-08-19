# Architecture and Routing

## High-Level Architecture

The app uses the Next.js App Router.

```text
Browser UI
  -> Auth0 SPA SDK gets access token
  -> lib/api.ts adds Authorization: Bearer <token>
  -> app/api/*/route.js
  -> functions/*.js
  -> shared/http.js authenticates and authorizes
  -> Supabase / ServiceNow / Auth0 Management API / Graph / Resend
```

Next route files are intentionally thin. For example, `app/api/submit-service-request/route.js` only imports `functions/submit-service-request.js`, sets `runtime = "nodejs"`, and exports the supported HTTP methods.

## App Router Structure

- `app/layout.tsx` wraps every route with `Providers`.
- `app/providers.tsx` configures Auth0 and the global toast provider.
- `app/page.tsx` is the root auth/role router.
- `app/portal/layout.tsx` gates all portal routes to `client_user`.
- `app/admin/layout.tsx` gates admin routes to admin-capable roles and renders the admin shell.
- `app/api/*/route.js` exposes server handlers.

The project keeps most implementation outside `app/`, which matches the Next.js App Router pattern where `app/` mainly defines routing and layouts.

## Client Routes

- `/` - Auth gate and role redirect.
- `/deactivated` - Account deactivated page.
- `/unauthorized` - No matching profile or forbidden role page.
- `/super-admin` - Super admin screen.
- `/portal` - Dashboard.
- `/portal/new-request` - Full service request form.
- `/portal/tickets` - Ticket list and detail view.
- `/portal/reports` - Client report list/downloads.

## Admin Routes

- `/admin` - Redirects to an admin default.
- `/admin/users` - User management.
- `/admin/p1-access` - P1 authorization management.
- `/admin/ms-team` - MS Team role management.
- `/admin/reports` - Report management/list.
- `/admin/reports/publish` - SharePoint file selection and report publishing.
- `/admin/support-contacts` - Support contact settings.
- `/admin/maintenance-events` - Maintenance banner list.
- `/admin/maintenance-events/new` - New maintenance banner.
- `/admin/maintenance-events/[id]/edit` - Edit maintenance banner.
- `/admin/audit-log` - Audit log search/list.

## Layouts and Session Timeout

Client portal:

- `components/portal/portal-shell.tsx`
- 60 minute idle timeout.
- Shows maintenance banner under the header.
- Uses `PortalProvider` for ticket polling and shared portal state.

Admin portal:

- `components/admin/admin-shell.tsx`
- 30 minute idle timeout.
- MS Team users only see Reports in navigation.
- Portal admins and super admins see the full admin nav.

## Shared Client Helpers

- `lib/api.ts` - Generic fetch wrapper. Adds content type and bearer token, parses JSON errors.
- `lib/tickets.ts` - Calls `/api/list-tickets` and normalizes ticket shapes.
- `lib/service-request.ts` - Calls `/api/submit-service-request`.
- `lib/attachments.ts` - Client-side attachment validation and base64 conversion.
- `lib/support-contacts.ts` - Support contact fetch/save helpers.
- `lib/roles.ts` - Role names and role helper functions.

## Adding a New API Endpoint

1. Create `functions/new-endpoint.js`.
2. Use helpers from `shared/http.js`.
3. Call `authenticate(req, allowedRoles)` unless the endpoint must be public.
4. Validate method and body.
5. Write audit logs for privileged changes.
6. Create `app/api/new-endpoint/route.js`.
7. Export `runtime = "nodejs"` and the supported HTTP methods.
8. Add a small client helper in `lib/` if the UI will call it from multiple places.
