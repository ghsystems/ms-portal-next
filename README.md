# MS Portal Next

GlassHouse Systems client portal built with Next.js 16, React 19, Auth0, Supabase, ServiceNow, Microsoft Graph/SharePoint, and Resend.

The app gives client users a portal for service requests, P1 incidents, ticket visibility, maintenance banners, support contacts, and downloadable reports. It also gives internal admins tools for user administration, report publishing, maintenance events, support contact settings, and audit log review.

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Useful scripts:

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run check:security
```

## Required Configuration

Create `.env.local` for local development. Do not commit it.

```bash
NEXT_PUBLIC_AUTH0_AUDIENCE=
NEXT_PUBLIC_API_BASE_URL=/api

AUTH0_DOMAIN=
AUTH0_AUDIENCE=
AUTH0_CLIENT_ID=
AUTH0_M2M_CLIENT_ID=
AUTH0_M2M_CLIENT_SECRET=

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
PORTAL_ALLOWED_ORIGINS=

SERVICENOW_INSTANCE_URL=
SERVICENOW_USERNAME=
SERVICENOW_PASSWORD=

GRAPH_TENANT_ID=
GRAPH_CLIENT_ID=
GRAPH_CLIENT_SECRET=
GRAPH_SHAREPOINT_SITE_URL=

RESEND_API_KEY=
PORTAL_FROM_EMAIL=
```

Notes:

- `NEXT_PUBLIC_API_BASE_URL` defaults to `/api`, which is correct for the deployed Next app.
- Browser code never talks to Supabase directly. All Supabase reads/writes go through `app/api/*` handlers using the service role key after Auth0 JWT verification.
- `PORTAL_ALLOWED_ORIGINS` is only needed if a separate frontend origin must call the API. Same-origin `/api` calls do not need it.

## Main Folders

- `app/` - Next.js App Router pages, layouts, and API route handlers.
- `views/` - Page-level React views used by the route files.
- `components/portal/` - Client portal shell, context, forms, banners, and shared portal UI.
- `components/admin/` - Admin shell and navigation.
- `components/ui/` - Shared UI primitives.
- `hooks/` - Auth/profile, idle timeout, support email, and table helpers.
- `lib/` - Browser-side API clients, validators, and portal helpers.
- `functions/` - Server-side endpoint handlers imported by `app/api/*/route.js`.
- `shared/` - Server-side integration helpers for Auth0, Supabase, ServiceNow, Graph, email, audit logging, HTTP, and security checks.
- `supabase/` - SQL migration/support scripts.
- `knowledge-base/` - Handover documentation for future maintainers.

## Route Overview

Client portal:

- `/` - Auth landing/router. Redirects users based on profile role.
- `/portal` - Client dashboard.
- `/portal/new-request` - Service request form.
- `/portal/tickets` - ServiceNow ticket list and detail view.
- `/portal/reports` - Published report downloads.

Admin portal:

- `/admin/users` - Invite, deactivate/reactivate, unlock, sort/filter users.
- `/admin/p1-access` - Grant or remove P1 incident authorization.
- `/admin/ms-team` - Manage MS Team members.
- `/admin/reports` - Admin report list.
- `/admin/reports/publish` - Publish SharePoint files as client reports.
- `/admin/support-contacts` - Edit support contact details.
- `/admin/maintenance-events` - Create, edit, and delete client maintenance banners.
- `/admin/audit-log` - Read audit log entries.

## Handover Docs

Start here:

- [Project overview](knowledge-base/01-project-overview.md)
- [Local development and configuration](knowledge-base/02-local-development-and-configuration.md)
- [Architecture and routing](knowledge-base/03-architecture-and-routing.md)
- [Authentication and authorization](knowledge-base/04-authentication-and-authorization.md)
- [Data model and Supabase](knowledge-base/05-data-model-and-supabase.md)
- [API and server functions](knowledge-base/06-api-and-server-functions.md)
- [Client portal workflows](knowledge-base/07-client-portal-workflows.md)
- [Admin portal workflows](knowledge-base/08-admin-portal-workflows.md)
- [ServiceNow integration](knowledge-base/09-servicenow-integration.md)
- [Reports and SharePoint integration](knowledge-base/10-reports-and-sharepoint.md)
- [Maintenance events and support contacts](knowledge-base/11-maintenance-and-support-contacts.md)
- [Security and operations](knowledge-base/12-security-and-operations.md)
- [Final handover checklist](knowledge-base/13-handover-checklist.md)

## Deployment Notes

The project is configured like a standard Next.js app. The current route handlers export `runtime = "nodejs"` and run through `app/api/*/route.js`.

Before handing over or deploying:

```bash
npm run lint
npm run check:security
npm run build
```

Also confirm production environment variables, Auth0 callback/logout URLs, Supabase RLS lockdown SQL, Graph app permissions, ServiceNow credentials, and Resend sender/domain setup.
