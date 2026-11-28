create table if not exists public.market_telegram_auth_nonces (
  auth_hash text primary key
    check (auth_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists market_telegram_auth_nonces_expires_idx
  on public.market_telegram_auth_nonces(expires_at);

alter table public.market_telegram_auth_nonces enable row level security;
revoke all on table public.market_telegram_auth_nonces from public, anon, authenticated;
grant all on table public.market_telegram_auth_nonces to service_role;

create policy market_telegram_auth_nonces_service_only
on public.market_telegram_auth_nonces
for all
to service_role
using (true)
with check (true);
