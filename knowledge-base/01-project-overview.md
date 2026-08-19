# Project Overview

## What This App Does

MS Portal Next is a GlassHouse Systems client portal. It has two main experiences:

- Client portal: clients submit service requests or P1 incidents, view their ServiceNow tickets, see maintenance banners, find support contacts, and download published reports.
- Admin portal: internal users manage portal users, P1 authorization, MS Team access, support contacts, maintenance events, reports, and audit logs.

The app is security-sensitive because it bridges client users to internal systems. The important design rule is that the browser never receives privileged backend credentials. Browser code calls the app's own API. API handlers verify Auth0 JWTs, load the caller profile from Supabase, authorize by role, then call Supabase, ServiceNow, Auth0 Management API, Graph/SharePoint, or Resend.

## Primary Systems

- Next.js 16 App Router hosts the UI and API routes.
- Auth0 authenticates users and issues access tokens for the portal API audience.
- Supabase stores portal metadata: profiles, clients, reports, settings, maintenance events, login failures, API rate limits, and audit logs.
- ServiceNow is the source of truth for tickets/incidents.
- Microsoft Graph/SharePoint stores report files.
- Resend sends ticket confirmation emails.

## User Roles

Roles are defined in `lib/roles.ts`.

- `client_user` - Client portal access only.
- `ghs_ms_team` - Admin shell access limited to report publishing/listing.
- `ghs_portal_admin` - Admin access for normal administrative work.
- `ghs_super_admin` - Highest privilege. Required to modify another super admin.

## Main User Flows

1. User signs in through Auth0.
2. `/` calls `/api/profile` through `useProfile`.
3. The profile role routes the user:
   - client users -> `/portal`
   - portal admins or super admins -> `/admin/users`
   - MS Team users -> `/admin/reports`
4. Client users submit requests to ServiceNow through `/api/submit-service-request`.
5. P1-authorized client users submit critical incidents through `/api/submit-p1-incident`.
6. Admin users publish SharePoint files as reports through `/api/publish-report`.
7. All privileged actions write audit entries in Supabase.

## Most Important Files

- `app/page.tsx` - Authenticated landing page and role router.
- `app/providers.tsx` - Auth0 provider and login redirect callback.
- `components/ProtectedRoute.tsx` - Client-side role gate for layouts/pages.
- `components/portal/portal-context.tsx` - Portal ticket polling and shared portal state.
- `components/portal/portal-shell.tsx` - Client portal layout/navigation.
- `components/admin/admin-shell.tsx` - Admin layout/navigation.
- `shared/http.js` - Server auth, Supabase client, CORS, errors, and role guards.
- `shared/verify-jwt.js` - Auth0 RS256 JWT verification.
- `shared/servicenow.js` - ServiceNow ticket and attachment helpers.
- `shared/graph.js` - Graph/SharePoint token and file helpers.
- `functions/*.js` - Actual API handler implementations.

## Maintenance Mindset

Keep the boundary clean:

- Browser code can hold Auth0 access tokens, never service secrets.
- Server handlers must call `authenticate` unless intentionally public.
- Supabase access should remain server-side with the service role key.
- Client validation is UX only. Server handlers must revalidate all important inputs.
- Audit logs should be append-only and written by server handlers.
