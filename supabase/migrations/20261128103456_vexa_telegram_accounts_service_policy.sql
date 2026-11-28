create policy market_telegram_accounts_service_only
on public.market_telegram_accounts
for all
to service_role
using (true)
with check (true);
