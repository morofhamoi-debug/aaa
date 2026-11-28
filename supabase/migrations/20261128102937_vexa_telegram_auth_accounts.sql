create table if not exists public.market_telegram_accounts (
  telegram_id text primary key
    check (telegram_id ~ '^[0-9]{1,16}$'),
  user_id uuid not null unique
    references auth.users(id) on delete cascade,
  telegram_username text
    check (telegram_username is null or length(telegram_username) <= 32),
  first_name text not null
    check (length(first_name) between 1 and 64),
  last_name text
    check (last_name is null or length(last_name) <= 64),
  photo_url text
    check (photo_url is null or (length(photo_url) <= 2048 and photo_url like 'https://t.me/%')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.market_telegram_accounts enable row level security;

revoke all on table public.market_telegram_accounts from public, anon, authenticated;
grant all on table public.market_telegram_accounts to service_role;
