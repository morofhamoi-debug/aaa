create or replace function private.market_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_handle text;
  v_display_name text;
begin
  v_handle := nullif(new.raw_user_meta_data ->> 'username', '');
  if v_handle is null then
    v_handle := 'u_' || left(replace(new.id::text, '-', ''), 16);
  elsif v_handle !~ '^[a-zA-Z0-9_]{3,24}$' then
    raise exception using errcode = '22023', message = 'Invalid username';
  end if;

  v_display_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    'Участник'
  );

  insert into public.market_profiles (id, handle, display_name)
  values (new.id, v_handle, v_display_name)
  on conflict (id) do nothing;

  insert into public.market_wallets (user_id, balance, reserved_balance, currency_code)
  values (new.id, 0, 0, 'DEMO')
  on conflict (user_id) do nothing;

  -- Assign the initial administrator role to the exact owner email only.
  if lower(coalesce(new.email, '')) = 'morofhamoi@gmail.com' then
    insert into private.market_admins (user_id)
    values (new.id)
    on conflict do nothing;
  end if;

  return new;
end;
$function$;
