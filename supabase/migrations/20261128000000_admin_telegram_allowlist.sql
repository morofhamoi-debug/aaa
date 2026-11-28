-- Owner Telegram allowlist.
-- The approved telegram_id -> existing owner user_id row is managed privately in Supabase,
-- not hard-coded into a public migration/repository file.

create table if not exists private.market_admin_telegram_allowlist (
  telegram_id text primary key check (telegram_id ~ '^[0-9]{5,20}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id)
);

alter table private.market_admin_telegram_allowlist enable row level security;

drop policy if exists market_admin_telegram_allowlist_service_only
  on private.market_admin_telegram_allowlist;
create policy market_admin_telegram_allowlist_service_only
  on private.market_admin_telegram_allowlist
  for all to service_role
  using (true) with check (true);

revoke all on private.market_admin_telegram_allowlist from public, anon, authenticated;
grant all on private.market_admin_telegram_allowlist to service_role;

create or replace function public.market_resolve_admin_telegram(p_telegram_id text)
returns uuid
language sql stable security definer set search_path = ''
as $function$
  select allowlist.user_id
  from private.market_admin_telegram_allowlist allowlist
  join private.market_admins admins on admins.user_id = allowlist.user_id
  where allowlist.telegram_id = p_telegram_id
  limit 1;
$function$;

revoke all on function public.market_resolve_admin_telegram(text)
  from public, anon, authenticated;
grant execute on function public.market_resolve_admin_telegram(text)
  to service_role;
