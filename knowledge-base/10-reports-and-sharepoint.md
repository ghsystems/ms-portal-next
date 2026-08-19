# Reports and SharePoint

## Purpose

Reports are presented in the portal as Supabase metadata records that point to files stored in SharePoint.

Users never receive raw SharePoint download URLs from the app. Downloads are proxied through `/api/download-report`.

## Main Files

- `shared/graph.js`
- `functions/list-sharepoint-files.js`
- `functions/publish-report.js`
- `functions/list-reports.js`
- `functions/download-report.js`
- `views/admin/admin-reports-publish-view.tsx`
- `views/admin/admin-reports-view.tsx`
- `views/reports-view.tsx`

## Graph Configuration

Required environment variables:

- `GRAPH_TENANT_ID`
- `GRAPH_CLIENT_ID`
- `GRAPH_CLIENT_SECRET`
- `GRAPH_SHAREPOINT_SITE_URL`

`shared/graph.js` uses client credentials to get Graph tokens.

## SharePoint Browsing

Admins and MS Team users browse SharePoint through `/api/list-sharepoint-files`.

The endpoint:

- Requires report-publishing roles.
- Accepts optional `itemId`.
- Validates `itemId` shape before using it in a Graph URL.
- Lists folders/files from the configured SharePoint site drive.
- Returns item id, drive id, name, folder/file marker, size, and modified date.

## Publishing a Report

`/api/publish-report` inserts a row into `reports`.

Required payload:

- `title`
- `type`
- `reportDate`
- `clientId`
- `sharepointItemId`
- `sharepointDriveId`

Allowed API report types:

- Monthly Managed Services Report
- Major Incident Report
- Annual SOC 2 Report

The row is inserted with `is_published = true`, publisher user id/email, and SharePoint ids.

## Listing Reports

`/api/list-reports` returns report metadata.

Rules:

- Admin/MS Team roles see all reports, including unpublished.
- Client users must have `client_id`.
- Client users see only published reports for their own client.

## Downloading Reports

`/api/download-report?id=<report_id>`:

1. Authenticates the user.
2. Loads report metadata from Supabase.
3. Returns 404 if report is missing or unpublished.
4. Allows admin/MS Team access to any report.
5. Allows client users only when `profile.client_id` matches `report.client_id`.
6. Gets a temporary SharePoint download URL server-side.
7. Fetches the file server-side.
8. Returns the file with content disposition headers.
9. Writes an audit log entry.

## Operational Checks

When report publishing or downloads fail, check:

- Entra app permissions and admin consent.
- Graph client secret expiry.
- `GRAPH_SHAREPOINT_SITE_URL`.
- SharePoint file permissions.
- Supabase report row has correct `sharepoint_item_id` and `sharepoint_drive_id`.
- User role and client assignment.
