# Local Development and Configuration

## Prerequisites

- Node.js compatible with Next.js 16 and React 19.
- npm.
- Access to the Auth0 tenant.
- Access to Supabase project settings.
- Access to ServiceNow integration credentials.
- Access to the Microsoft Entra app registration used for Graph.
- Access to Resend if email confirmation testing is needed.

## Install and Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Use these before handoff or deployment:

```bash
npm run lint
npm run check:security
npm run build
```

## Environment Variables

Public browser variables:

- `NEXT_PUBLIC_AUTH0_AUDIENCE` - API audience requested by the Auth0 SPA SDK.
- `NEXT_PUBLIC_API_BASE_URL` - Browser API base path. Defaults to `/api`.

Auth0 server variables:

- `AUTH0_DOMAIN` - Auth0 tenant domain, without `https://`.
- `AUTH0_AUDIENCE` - Expected API audience for server-side JWT verification.
- `AUTH0_CLIENT_ID` - SPA/client id used for password reset invitation flow.
- `AUTH0_M2M_CLIENT_ID` - Machine-to-machine client id for Management API.
- `AUTH0_M2M_CLIENT_SECRET` - Machine-to-machine client secret.

Supabase variables:

- `SUPABASE_URL` - Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY` - Server-only service role key.
- `PORTAL_ALLOWED_ORIGINS` - Optional comma-separated CORS allowlist for non-same-origin API callers.

ServiceNow variables:

- `SERVICENOW_INSTANCE_URL` - Base instance URL.
- `SERVICENOW_USERNAME` - Basic auth user.
- `SERVICENOW_PASSWORD` - Basic auth password.

Microsoft Graph variables:

- `GRAPH_TENANT_ID` - Entra tenant id.
- `GRAPH_CLIENT_ID` - App registration client id.
- `GRAPH_CLIENT_SECRET` - App registration client secret.
- `GRAPH_SHAREPOINT_SITE_URL` - SharePoint site URL used for report file browsing.

Email variables:

- `RESEND_API_KEY` - Resend API key.
- `PORTAL_FROM_EMAIL` - Verified sender address.

## Auth0 Local Setup

For local development, Auth0 must allow:

- Callback URL: `http://localhost:3000`
- Logout URL: `http://localhost:3000`
- Web origin: `http://localhost:3000`

The SPA requests `NEXT_PUBLIC_AUTH0_AUDIENCE`. The API verifies tokens against `AUTH0_AUDIENCE`. These should match the Auth0 API identifier.

## Common Local Issues

- Infinite login loop: check Auth0 callback/logout URLs and audience variables.
- `/api/profile` returns 401: the user exists in Auth0 but has no matching Supabase `profiles.auth0_user_id`.
- Client portal shows no tickets: check the user's `client_id`, ServiceNow credentials, and client company mapping.
- Report publishing cannot browse files: check Graph credentials, SharePoint site URL, and Entra permissions.
- Emails do not send: check Resend API key, verified sender/domain, and `PORTAL_FROM_EMAIL`.

## Do Not Commit

Never commit `.env.local`, service keys, Auth0 secrets, Graph secrets, ServiceNow credentials, downloaded report files, or exported user data.
