-- VEXA first-mint ownership and collectible supply guard.
-- Applied to Supabase as 20261127223616_vexa_inventory_ownership_and_visibility.

create or replace function public.market_admin_create_variant(
  p_actor_id uuid, p_gift_type_id uuid, p_name text, p_rarity text,
  p_description text, p_image_url text, p_model_url text,
  p_model_size_bytes bigint, p_initial_price bigint,
  p_max_supply integer, p_mint_quantity integer, p_status text
)
returns jsonb language plpgsql security definer set search_path = ''
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

  select * into v_gift from public.market_gift_types
  where id=p_gift_type_id for update;
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
      values(v_asset_id,v_next_serial+i,p_actor_id);
    end loop;
  end if;

  insert into private.market_admin_audit(actor_id,action,target_type,target_id,details)
  values(p_actor_id,'variant.create_and_mint','variant',v_asset_id,
    jsonb_build_object('gift_type_id',p_gift_type_id,'rarity',p_rarity,
      'max_supply',p_max_supply,'minted',p_mint_quantity,'initial_owner_id',p_actor_id));

  return jsonb_build_object('id',v_asset_id,'minted',p_mint_quantity,'max_supply',p_max_supply,
    'initial_owner_id',p_actor_id);
end;
$$;
revoke all on function public.market_admin_create_variant(uuid,uuid,text,text,text,text,text,bigint,bigint,integer,integer,text)
  from public, anon, authenticated;
grant execute on function public.market_admin_create_variant(uuid,uuid,text,text,text,text,text,bigint,bigint,integer,integer,text)
  to service_role;

create or replace function private.market_enforce_collectible_supply()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_max_supply integer;
  v_existing integer;
begin
  select max_supply into v_max_supply from public.market_assets
  where id=new.asset_id for update;
  if not found then raise exception using errcode='23503', message='Asset not found'; end if;
  select count(*) into v_existing from public.market_collectibles where asset_id=new.asset_id;
  if v_existing>=v_max_supply then
    raise exception using errcode='23514', message='Mint quantity exceeds max supply';
  end if;
  return new;
end;
$$;
revoke all on function private.market_enforce_collectible_supply() from public, anon, authenticated;
drop trigger if exists market_enforce_collectible_supply_before_insert on public.market_collectibles;
create trigger market_enforce_collectible_supply_before_insert
before insert on public.market_collectibles
for each row execute function private.market_enforce_collectible_supply();

drop policy if exists market_collectibles_public_read on public.market_collectibles;
create policy market_collectibles_public_read on public.market_collectibles
for select to anon, authenticated
using (
  owner_id=(select auth.uid())
  or exists (
    select 1 from public.market_assets a
    join public.market_collections c on c.id=a.collection_id
    where a.id=market_collectibles.asset_id
      and a.status='published' and c.status='published'
  )
);
