-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
--
-- Why: the browser used to query Supabase directly with the anon key and an Auth0
-- access token. Supabase cannot validate an Auth0 JWT, so every one of those
-- requests arrived as the `anon` role — which is why the policies had to be left
-- permissive for the app to work. Verified before this change: an anonymous
-- caller holding only the publicly-shipped anon key could read the entire
-- `clients` table.
--
-- The app now reaches Supabase exclusively through its own API using the service
-- role key, which bypasses RLS by design. So `anon` and `authenticated` need no
-- privileges at all, and denying them costs the application nothing.

begin;

-- 1. New table backing per-IP throttling of the unauthenticated
--    check-account-status endpoint.
create table if not exists public.api_rate_limits (
  id          uuid primary key default gen_random_uuid(),
  ip          text not null,
  endpoint    text not null,
  created_at  timestamptz not null default now()
);

create index if not exists api_rate_limits_lookup_idx
  on public.api_rate_limits (endpoint, ip, created_at desc);

-- 2. Lockouts are now resolved rather than deleted, so the attempt history
--    survives an unlock (SOC 2 CC7.2 — the trail is the evidence).
alter table public.login_failures
  add column if not exists resolved_at timestamptz;

create index if not exists login_failures_lookup_idx
  on public.login_failures (email, created_at desc) where resolved_at is null;

-- 3. Enable RLS everywhere and drop every existing policy. With no policy left,
--    RLS denies all access to anon/authenticated; the service role is unaffected.
do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'profiles', 'clients', 'reports', 'audit_logs', 'login_failures',
    'maintenance_events', 'maintenance_event_clients', 'site_settings',
    'api_rate_limits'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);

    for p in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;

    -- Belt and braces: PostgREST reaches the table through these roles, so
    -- revoking the grants means a future policy can't accidentally re-open it.
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- 4. Audit entries are append-only. Even the service role should not be able to
--    rewrite history, so updates and deletes are refused at the table level.
create or replace function public.audit_logs_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_logs is append-only';
end $$;

drop trigger if exists audit_logs_no_update on public.audit_logs;
create trigger audit_logs_no_update
  before update or delete on public.audit_logs
  for each row execute function public.audit_logs_immutable();

commit;

-- 5. Retention. login_failures and api_rate_limits hold email addresses and IPs
--    with no reason to keep them long-term. Schedule this with pg_cron
--    (Database → Extensions → enable pg_cron) or run it periodically.
--
-- select cron.schedule('purge-portal-transients', '0 3 * * *', $$
--   delete from public.login_failures where created_at < now() - interval '90 days';
--   delete from public.api_rate_limits where created_at < now() - interval '7 days';
-- $$);
