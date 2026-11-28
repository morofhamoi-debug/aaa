# Supabase backend

Project: `jdcypiuvykyfqfyllsji`

## Data model

The original marketplace tables already existed in the linked Supabase project before the repository was rebuilt. New marketplace features have been applied to that project as database migrations.

Core relations:

- `market_collections` → `market_gift_types` → `market_assets`
- `market_assets` → `market_collectibles` (individual serial-numbered NFT instances)
- `market_collectibles` + `market_assets` → `market_orders`
- `market_orders` → `market_trades`
- `market_trades` → `market_price_candles` (aggregated by 1m / 5m / 15m / 1h / 4h / 1d)
- `auth.users` → `market_profiles`, `market_telegram_accounts`, `market_wallets`, `market_user_preferences`
- `market_wallets` → `market_wallet_ledger`
- `auth.users` → `private.market_user_restrictions`
- `private.market_platform_ledger` → `market_trades`

The extra `asset_id` and `scope` fields on `market_orders` distinguish a listing/order for a particular serial-numbered collectible from a buy request that applies to any instance of an NFT model.

## Edge Functions

### telegram-auth

Receives Telegram Mini App `initData`, verifies the Telegram HMAC signature with the server-only `TELEGRAM_BOT_TOKEN`, rejects expired/replayed requests and issues a Supabase Auth token hash. The frontend completes the Supabase session using `verifyOtp`.

### market-api

Uses the caller's authenticated Supabase session. Privileged database operations use the server-side Supabase service role and SECURITY DEFINER functions that verify the actor against `private.market_admins`.

Available groups of actions include:

- Market data and USD/RUB reference rate.
- Buy/sell orders and order cancellation.
- Admin overview and market settings.
- Collection, gift model and NFT model creation.
- NFT minting and publishing controls.
- User search/details, balance adjustments and restrictions.
- Admin audit log.

Never expose a service-role key or bot token in browser JavaScript.

## Storage

Bucket: `market-assets`

- Public read for gift media.
- Admin-only upload/update/delete, limited to the `models/` path.
- 25 MiB maximum file size.
- GIF, WebP, AVIF, MP4, WebM, QuickTime and GLB-compatible MIME types.

## Empty catalog guarantee

The implementation does not insert example content. No collection, gift type, asset variant or collectible instance has been created as part of this build. The admin creates all catalog content manually.
