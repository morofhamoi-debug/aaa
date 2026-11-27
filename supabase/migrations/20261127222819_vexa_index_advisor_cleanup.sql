-- VEXA index advisor cleanup
-- Keep the pre-existing unique sell-listing index and remove only the redundant VEXA duplicate.
drop index if exists public.market_one_open_sell_order_per_collectible_idx;

create index if not exists market_admin_audit_actor_idx on private.market_admin_audit(actor_id);
create index if not exists market_admins_created_by_idx on private.market_admins(created_by);
create index if not exists market_platform_settings_updated_by_idx on private.market_platform_settings(updated_by);
create index if not exists market_assets_created_by_idx on public.market_assets(created_by);
create index if not exists market_gift_types_created_by_idx on public.market_gift_types(created_by);
create index if not exists market_wallet_ledger_actor_idx on public.market_wallet_ledger(actor_id);
