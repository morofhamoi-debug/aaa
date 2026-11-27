-- VEXA marketplace foundation
-- Applied to the linked Supabase project as migration 20261127222719.
-- Additive migration: the original market_* tables and their records are preserved.

create table if not exists private.market_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create or replace function private.market_is_admin(p_user_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from private.market_admins a where a.user_id = p_user_id);
$$;
revoke all on function private.market_is_admin(uuid) from public, anon;
grant usage on schema private to authenticated, service_role;
grant execute on function private.market_is_admin(uuid) to authenticated, service_role;

create table if not exists private.market_admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  action text not null,
  target_type text,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists private.market_platform_settings (
  singleton boolean primary key default true check (singleton),
  trading_enabled boolean not null default true,
  commission_bps integer not null default 0 check (commission_bps between 0 and 1000),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
insert into private.market_platform_settings(singleton, trading_enabled, commission_bps)
values (true, true, 0)
on conflict (singleton) do nothing;

create table if not exists public.market_gift_types (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.market_collections(id),
  slug text not null unique,
  name text not null check (length(btrim(name)) between 1 and 80),
  description text,
  cover_url text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.market_assets
  add column if not exists gift_type_id uuid references public.market_gift_types(id),
  add column if not exists model_url text,
  add column if not exists model_format text,
  add column if not exists model_size_bytes bigint,
  add column if not exists initial_price bigint not null default 0,
  add column if not exists status text not null default 'draft',
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists published_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='market_assets_status_check' and conrelid='public.market_assets'::regclass) then
    alter table public.market_assets add constraint market_assets_status_check check (status in ('draft','published','archived'));
  end if;
  if not exists (select 1 from pg_constraint where conname='market_assets_initial_price_check' and conrelid='public.market_assets'::regclass) then
    alter table public.market_assets add constraint market_assets_initial_price_check check (initial_price >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname='market_assets_model_size_check' and conrelid='public.market_assets'::regclass) then
    alter table public.market_assets add constraint market_assets_model_size_check check (model_size_bytes is null or model_size_bytes between 1 and 26214400);
  end if;
  if not exists (select 1 from pg_constraint where conname='market_assets_model_format_check' and conrelid='public.market_assets'::regclass) then
    alter table public.market_assets add constraint market_assets_model_format_check check (model_format is null or model_format='glb');
  end if;
end $$;

alter table public.market_wallet_ledger
  add column if not exists actor_id uuid references auth.users(id),
  add column if not exists reason text;

create table if not exists public.market_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists market_notifications_user_created_idx
  on public.market_notifications(user_id, created_at desc);

create table if not exists public.market_exchange_rates (
  base_currency text not null,
  quote_currency text not null,
  rate numeric(20,8) not null check (rate > 0),
  source text not null,
  source_date date,
  fetched_at timestamptz not null default now(),
  primary key (base_currency, quote_currency)
);

create index if not exists market_gift_types_collection_idx
  on public.market_gift_types(collection_id, status);
create index if not exists market_assets_gift_type_idx
  on public.market_assets(gift_type_id, status);
create index if not exists market_assets_status_created_idx
  on public.market_assets(status, created_at desc);

alter table public.market_gift_types enable row level security;
alter table public.market_notifications enable row level security;
alter table public.market_exchange_rates enable row level security;

grant select on public.market_gift_types to anon, authenticated;
grant select on public.market_notifications to authenticated;
grant select on public.market_exchange_rates to anon, authenticated;

drop policy if exists market_assets_public_read on public.market_assets;
create policy market_assets_public_read on public.market_assets
for select to anon, authenticated
using (
  (status='published' and exists (
    select 1 from public.market_collections c
    where c.id=market_assets.collection_id and c.status='published'
  ))
  or created_by=(select auth.uid())
);

drop policy if exists market_gift_types_public_read on public.market_gift_types;
create policy market_gift_types_public_read on public.market_gift_types
for select to anon, authenticated
using (
  (status='published' and exists (
    select 1 from public.market_collections c
    where c.id=market_gift_types.collection_id and c.status='published'
  ))
  or created_by=(select auth.uid())
);

drop policy if exists market_notifications_owner_read on public.market_notifications;
create policy market_notifications_owner_read on public.market_notifications
for select to authenticated using ((select auth.uid())=user_id);

drop policy if exists market_exchange_rates_public_read on public.market_exchange_rates;
create policy market_exchange_rates_public_read on public.market_exchange_rates
for select to anon, authenticated using (true);

create or replace function private.market_handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_handle text;
  v_display_name text;
begin
  v_handle := nullif(new.raw_user_meta_data->>'username','');
  if v_handle is null then
    v_handle := 'u_' || left(replace(new.id::text,'-',''),16);
  elsif v_handle !~ '^[a-zA-Z0-9_]{3,24}$' then
    raise exception using errcode='22023', message='Invalid username';
  end if;

  v_display_name := coalesce(
    nullif(new.raw_user_meta_data->>'display_name',''),
    nullif(new.raw_user_meta_data->>'name',''),
    'Участник'
  );

  insert into public.market_profiles(id,handle,display_name)
  values(new.id,v_handle,v_display_name)
  on conflict(id) do nothing;

  insert into public.market_wallets(user_id,balance,reserved_balance,currency_code)
  values(new.id,0,0,'DEMO')
  on conflict(user_id) do nothing;

  return new;
end;
$$;
revoke all on function private.market_handle_new_user() from public, anon, authenticated;

create or replace function public.market_admin_is_authorized(p_actor_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select private.market_is_admin(p_actor_id); $$;
revoke all on function public.market_admin_is_authorized(uuid) from public, anon, authenticated;
grant execute on function public.market_admin_is_authorized(uuid) to service_role;

create or replace function public.market_admin_overview(p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  if not private.market_is_admin(p_actor_id) then
    raise exception using errcode='42501', message='Administrator access required';
  end if;
  return jsonb_build_object(
    'users',(select count(*) from auth.users),
    'collections',(select count(*) from public.market_collections),
    'gift_types',(select count(*) from public.market_gift_types),
    'variants',(select count(*) from public.market_assets),
    'collectibles',(select count(*) from public.market_collectibles),
    'trades',(select count(*) from public.market_trades),
    'trade_volume',coalesce((select sum(price) from public.market_trades),0),
    'open_orders',(select count(*) from public.market_orders where status='open')
  );
end;
$$;
revoke all on function public.market_admin_overview(uuid) from public, anon, authenticated;
grant execute on function public.market_admin_overview(uuid) to service_role;

create or replace function public.market_admin_create_collection(
  p_actor_id uuid,p_name text,p_slug text,p_description text,p_cover_url text,p_status text
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if not private.market_is_admin(p_actor_id) then
    raise exception using errcode='42501', message='Administrator access required';
  end if;
  if length(btrim(coalesce(p_name,''))) not between 1 and 80
    or length(btrim(coalesce(p_slug,''))) not between 2 and 80
    or p_status not in ('draft','published','archived') then
    raise exception using errcode='22023', message='Invalid collection fields';
  end if;
  insert into public.market_collections(slug,name,description,cover_url,creator_id,status)
  values(lower(p_slug),btrim(p_name),nullif(btrim(coalesce(p_description,'')),''),nullif(p_cover_url,''),p_actor_id,p_status)
  returning id into v_id;
  insert into private.market_admin_audit(actor_id,action,target_type,target_id,details)
  values(p_actor_id,'collection.create','collection',v_id,jsonb_build_object('name',btrim(p_name),'status',p_status));
  return jsonb_build_object('id',v_id,'status',p_status);
end;
$$;
revoke all on function public.market_admin_create_collection(uuid,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.market_admin_create_collection(uuid,text,text,text,text,text) to service_role;

create or replace function public.market_admin_create_gift_type(
  p_actor_id uuid,p_collection_id uuid,p_name text,p_slug text,p_description text,p_cover_url text,p_status text
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if not private.market_is_admin(p_actor_id) then
    raise exception using errcode='42501', message='Administrator access required';
  end if;
  if p_collection_id is null or length(btrim(coalesce(p_name,''))) not between 1 and 80
    or length(btrim(coalesce(p_slug,''))) not between 2 and 80
    or p_status not in ('draft','published','archived') then
    raise exception using errcode='22023', message='Invalid gift fields';
  end if;
  insert into public.market_gift_types(collection_id,slug,name,description,cover_url,status,created_by)
  values(p_collection_id,lower(p_slug),btrim(p_name),nullif(btrim(coalesce(p_description,'')),''),nullif(p_cover_url,''),p_status,p_actor_id)
  returning id into v_id;
  insert into private.market_admin_audit(actor_id,action,target_type,target_id,details)
  values(p_actor_id,'gift_type.create','gift_type',v_id,jsonb_build_object('collection_id',p_collection_id,'name',btrim(p_name),'status',p_status));
  return jsonb_build_object('id',v_id,'status',p_status);
end;
$$;
revoke all on function public.market_admin_create_gift_type(uuid,uuid,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.market_admin_create_gift_type(uuid,uuid,text,text,text,text,text) to service_role;

create or replace function public.market_admin_create_variant(
  p_actor_id uuid,p_gift_type_id uuid,p_name text,p_rarity text,p_description text,
  p_image_url text,p_model_url text,p_model_size_bytes bigint,p_initial_price bigint,
  p_max_supply integer,p_mint_quantity integer,p_status text
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_gift public.market_gift_types%rowtype;
  v_asset_id uuid;
  v_minted integer;
  v_next_serial integer;
  i integer;
begin
  if not private.market_is_admin(p_actor_id) then
    raise exception using errcode='42501', message='Administrator access required';
  end if;
  if p_gift_type_id is null or length(btrim(coalesce(p_name,''))) not between 1 and 120
    or length(btrim(coalesce(p_rarity,''))) not between 1 and 40
    or p_initial_price is null or p_initial_price<0
    or p_max_supply is null or p_max_supply<1
    or p_mint_quantity is null or p_mint_quantity<0 or p_mint_quantity>p_max_supply
    or p_status not in ('draft','published','archived')
    or (p_model_size_bytes is not null and p_model_size_bytes>26214400) then
    raise exception using errcode='22023', message='Invalid variant parameters';
  end if;
  select * into v_gift from public.market_gift_types where id=p_gift_type_id for update;
  if not found then raise exception using errcode='P0002', message='Gift type not found'; end if;

  insert into public.market_assets(
    collection_id,gift_type_id,name,description,image_url,rarity,max_supply,
    model_url,model_format,model_size_bytes,initial_price,status,created_by,published_at
  ) values (
    v_gift.collection_id,p_gift_type_id,btrim(p_name),nullif(btrim(coalesce(p_description,'')),''),
    nullif(p_image_url,''),btrim(p_rarity),p_max_supply,nullif(p_model_url,''),
    case when nullif(p_model_url,'') is null then null else 'glb' end,
    p_model_size_bytes,p_initial_price,p_status,p_actor_id,
    case when p_status='published' then now() else null end
  ) returning id into v_asset_id;

  select count(*),coalesce(max(serial_number),0)
  into v_minted,v_next_serial
  from public.market_collectibles where asset_id=v_asset_id;

  if v_minted+p_mint_quantity>p_max_supply then
    raise exception using errcode='22023', message='Mint quantity exceeds max supply';
  end if;

  if p_mint_quantity>0 then
    for i in 1..p_mint_quantity loop
      insert into public.market_collectibles(asset_id,serial_number,owner_id)
      values(v_asset_id,v_next_serial+i,null);
    end loop;
  end if;

  insert into private.market_admin_audit(actor_id,action,target_type,target_id,details)
  values(p_actor_id,'variant.create_and_mint','variant',v_asset_id,
    jsonb_build_object('gift_type_id',p_gift_type_id,'rarity',p_rarity,'max_supply',p_max_supply,'minted',p_mint_quantity));
  return jsonb_build_object('id',v_asset_id,'minted',p_mint_quantity,'max_supply',p_max_supply);
end;
$$;
revoke all on function public.market_admin_create_variant(uuid,uuid,text,text,text,text,text,bigint,bigint,integer,integer,text) from public, anon, authenticated;
grant execute on function public.market_admin_create_variant(uuid,uuid,text,text,text,text,text,bigint,bigint,integer,integer,text) to service_role;

create or replace function public.market_admin_adjust_balance(
  p_actor_id uuid,p_user_id uuid,p_amount bigint,p_reason text
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_balance bigint;
begin
  if not private.market_is_admin(p_actor_id) then
    raise exception using errcode='42501', message='Administrator access required';
  end if;
  if p_user_id is null or p_amount is null or p_amount<=0 or p_amount>1000000000
    or length(btrim(coalesce(p_reason,''))) not between 3 and 500 then
    raise exception using errcode='22023', message='Invalid balance adjustment';
  end if;
  insert into public.market_wallets(user_id,balance,reserved_balance,currency_code)
  values(p_user_id,0,0,'DEMO') on conflict(user_id) do nothing;
  update public.market_wallets set balance=balance+p_amount,updated_at=now()
  where user_id=p_user_id returning balance into v_balance;
  insert into public.market_wallet_ledger(user_id,entry_type,amount,balance_after,description,actor_id,reason)
  values(p_user_id,'admin_adjustment',p_amount,v_balance,'Административное начисление',p_actor_id,btrim(p_reason));
  insert into public.market_notifications(user_id,notification_type,title,body,payload)
  values(p_user_id,'balance_credit','Баланс обновлён','Администратор начислил внутренние баллы VEXA.',
    jsonb_build_object('amount',p_amount,'reason',btrim(p_reason)));
  insert into private.market_admin_audit(actor_id,action,target_type,target_id,details)
  values(p_actor_id,'wallet.credit','user',p_user_id,jsonb_build_object('amount',p_amount,'reason',btrim(p_reason)));
  return jsonb_build_object('user_id',p_user_id,'balance',v_balance);
end;
$$;
revoke all on function public.market_admin_adjust_balance(uuid,uuid,bigint,text) from public, anon, authenticated;
grant execute on function public.market_admin_adjust_balance(uuid,uuid,bigint,text) to service_role;

create or replace function public.market_admin_update_settings(
  p_actor_id uuid,p_trading_enabled boolean,p_commission_bps integer
) returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  if not private.market_is_admin(p_actor_id) then
    raise exception using errcode='42501', message='Administrator access required';
  end if;
  if p_trading_enabled is null or p_commission_bps not between 0 and 1000 then
    raise exception using errcode='22023', message='Invalid market settings';
  end if;
  insert into private.market_platform_settings(singleton,trading_enabled,commission_bps,updated_by,updated_at)
  values(true,p_trading_enabled,p_commission_bps,p_actor_id,now())
  on conflict(singleton) do update set trading_enabled=excluded.trading_enabled,
    commission_bps=excluded.commission_bps,updated_by=excluded.updated_by,updated_at=now();
  insert into private.market_admin_audit(actor_id,action,target_type,details)
  values(p_actor_id,'market.settings.update','settings',jsonb_build_object('trading_enabled',p_trading_enabled,'commission_bps',p_commission_bps));
  return jsonb_build_object('trading_enabled',p_trading_enabled,'commission_bps',p_commission_bps);
end;
$$;
revoke all on function public.market_admin_update_settings(uuid,boolean,integer) from public, anon, authenticated;
grant execute on function public.market_admin_update_settings(uuid,boolean,integer) to service_role;

create or replace function public.market_get_market_status()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'trading_enabled',coalesce((select trading_enabled from private.market_platform_settings where singleton),true),
    'commission_bps',coalesce((select commission_bps from private.market_platform_settings where singleton),0)
  );
$$;
revoke all on function public.market_get_market_status() from public, anon, authenticated;
grant execute on function public.market_get_market_status() to service_role;

create or replace function public.market_mark_notification_read(p_actor_id uuid,p_notification_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  update public.market_notifications set read_at=coalesce(read_at,now())
  where id=p_notification_id and user_id=p_actor_id;
  return found;
end;
$$;
revoke all on function public.market_mark_notification_read(uuid,uuid) from public, anon, authenticated;
grant execute on function public.market_mark_notification_read(uuid,uuid) to service_role;

create or replace function private.market_notify_trade()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.market_notifications(user_id,notification_type,title,body,payload)
  values
    (new.buyer_id,'trade_bought','Покупка завершена','NFT успешно приобретён.',
      jsonb_build_object('trade_id',new.id,'collectible_id',new.collectible_id,'price',new.price)),
    (new.seller_id,'trade_sold','Продажа завершена','Ваш NFT успешно продан.',
      jsonb_build_object('trade_id',new.id,'collectible_id',new.collectible_id,'price',new.price));
  return new;
end;
$$;
revoke all on function private.market_notify_trade() from public, anon, authenticated;
drop trigger if exists market_notify_trade_after_insert on public.market_trades;
create trigger market_notify_trade_after_insert after insert on public.market_trades
for each row execute function private.market_notify_trade();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('market-assets','market-assets',true,26214400,
  array['model/gltf-binary','application/octet-stream','model/gltf+json','image/png','image/jpeg','image/webp'])
on conflict(id) do nothing;

drop policy if exists vexa_admin_upload_market_assets on storage.objects;
create policy vexa_admin_upload_market_assets on storage.objects
for insert to authenticated with check (
  bucket_id='market-assets' and (storage.foldername(name))[1]='models'
  and private.market_is_admin((select auth.uid()))
);
drop policy if exists vexa_admin_update_market_assets on storage.objects;
create policy vexa_admin_update_market_assets on storage.objects
for update to authenticated using (
  bucket_id='market-assets' and (storage.foldername(name))[1]='models'
  and private.market_is_admin((select auth.uid()))
) with check (
  bucket_id='market-assets' and (storage.foldername(name))[1]='models'
  and private.market_is_admin((select auth.uid()))
);
drop policy if exists vexa_admin_delete_market_assets on storage.objects;
create policy vexa_admin_delete_market_assets on storage.objects
for delete to authenticated using (
  bucket_id='market-assets' and (storage.foldername(name))[1]='models'
  and private.market_is_admin((select auth.uid()))
);
