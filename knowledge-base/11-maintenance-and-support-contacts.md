# Maintenance Events and Support Contacts

## Maintenance Events

Maintenance events power the portal banner under the header.

Main files:

- `functions/maintenance-events.js`
- `components/portal/maintenance-events-banner.tsx`
- `components/portal/maintenance-events-storage.ts`
- `components/portal/banner-config.ts`
- `views/admin/maintenance-events-view.tsx`
- `views/admin/maintenance-event-form-view.tsx`

## Event Fields

Server validation requires:

- `title`
- `message`
- `type`
- `starts_at`
- `ends_at`
- `all_clients`
- `client_ids` when not all clients

Supported types:

- `info`
- `warning`
- `critical`
- `maintenance`

`ends_at` must be after `starts_at`.

## Targeting

Events can target:

- all clients, or
- selected clients through `maintenance_event_clients`

Admins see all events. Client users receive only events that are all-client or linked to their `profile.client_id`.

## Dismissal Behavior

The portal stores dismissed maintenance events client-side using `components/portal/maintenance-events-storage.ts`.

Dismissals are cleared:

- after completed Auth0 login redirect in `app/providers.tsx`
- on manual portal logout
- on portal idle timeout

This makes active banners reappear on next login.

## Support Contacts

Support contacts are stored in `site_settings` under key `support_contacts`.

Main files:

- `functions/site-settings.js`
- `lib/support-contacts.ts`
- `hooks/useSupportEmail.ts`
- `views/admin/support-contacts-view.tsx`

Fields:

- `managedServicesEmail`
- `managedServicesPhone`
- `hotlinePhone`
- `escalationManagerName`
- `escalationManagerEmail`
- `escalationManagerPhone`

## Public Support Email

Pre-auth pages cannot call authenticated APIs, so `GET /api/site-settings?public=1` returns only:

- `managedServicesEmail`

If this fails or the setting is missing, the UI falls back to `support@ghsystems.com`.

## Admin Updates

`PUT /api/site-settings` requires an admin role and validates:

- all fields are strings no longer than 200 characters
- managed services email is valid
- escalation manager email is valid

Updates are audit logged.
