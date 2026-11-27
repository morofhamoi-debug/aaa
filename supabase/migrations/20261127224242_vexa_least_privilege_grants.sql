-- VEXA least-privilege grants
-- Applied to the linked Supabase project as migration 20261127224242_vexa_least_privilege_grants.
-- Browser sessions are read-only for these metadata/admin tables; the Edge Function
-- performs authorized writes using service_role after checking the signed-in actor.

revoke all privileges on table
  public.market_gift_types,
  public.market_notifications,
  public.market_exchange_rates
from public, anon, authenticated;

grant select on table public.market_gift_types to anon, authenticated;
grant select on table public.market_exchange_rates to anon, authenticated;
grant select on table public.market_notifications to authenticated;

revoke all privileges on table
  private.market_admins,
  private.market_admin_audit,
  private.market_platform_settings
from public, anon, authenticated;

revoke all on function public.market_admin_is_authorized(uuid) from public, anon, authenticated;
grant execute on function public.market_admin_is_authorized(uuid) to service_role;
