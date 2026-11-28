# Telegram NFT Gifts Marketplace

A lightweight Telegram Mini App for collectible digital gifts. The project is intentionally minimal: three tabs (**Market**, **My NFT**, **Settings**) and a private admin panel.

## What is implemented

- Telegram Mini App sign-in only. There is no Gmail or email login screen.
- Automatic account creation/linking from Telegram Mini App data: Telegram ID, username, first/last name and profile photo.
- Marketplace collections and individual collectible instances, each with a serial number.
- Per-instance fixed-price listings and direct purchases.
- Model-wide buy requests: a buyer sets a maximum price and reserves the amount; the request can match any instance of that model.
- My NFT inventory grouped by collection.
- Candlestick chart based on completed trades only. No fake candle or price data is generated.
- Admin dashboard, user lookup, credits/debits, temporary/permanent restrictions, catalog management, minting, market pause, fee configuration and audit log.
- GIF/WebP/AVIF/MP4/WebM previews and GLB 3D models uploaded to Supabase Storage.
- Light theme by default, optional dark theme.
- RUB/USD balance display switch using the Bank of Russia USD/RUB rate. This changes display only, not the underlying balance.

## Important: the catalog starts empty

No sample collections, gift models, NFT variants or collectible instances are inserted by this repository. The catalog is intentionally empty. The owner creates everything manually from **Settings → Admin panel → Collections and NFT**.

The admin flow is:

1. Create a collection.
2. Create a gift model inside that collection.
3. Create an NFT variant with rarity, supply, initial price, image/animation and optional GLB file.
4. Mint the desired number of instances. The default mint quantity is zero.
5. Publish the collection/model/variant.

## Repository layout

- `index.html` — Mini App entry page.
- `app.js` — Telegram auth, navigation, marketplace UI and admin UI.
- `styles.css` — responsive light/dark styling.
- `config.js` — public Supabase URL and publishable client key only.
- `supabase/functions/telegram-auth/index.ts` — validates Telegram WebApp initData and issues a Supabase session.
- `supabase/functions/market-api/index.ts` — authenticated server API for orders and administration.
- `supabase/types/database.types.ts` — generated public database types.
- `.github/workflows/pages.yml` — deploys the static Mini App to GitHub Pages.

The remote Supabase project already contained the original marketplace foundation before this repository was rebuilt. The current repository includes the live Edge Function source and generated types; it is not a full historical dump of the original database's initial migrations.

## Supabase configuration

Project ID: `jdcypiuvykyfqfyllsji`

The browser uses only the Supabase publishable key in `config.js`. Never place a service-role key or bot token in any frontend file.

The following Edge Function secret must exist in Supabase:

- `TELEGRAM_BOT_TOKEN` — token of the Telegram bot that hosts the Mini App.

Both Edge Functions are configured with platform JWT verification disabled because they perform their own request validation:
- `telegram-auth` validates Telegram's initData HMAC, checks its age and prevents replay.
- `market-api` requires a valid Supabase user session and performs admin/ownership checks server-side.

See [supabase/README.md](supabase/README.md) for the database and security model.

## GitHub Pages deployment

1. Open the repository **Settings → Pages**.
2. Set **Build and deployment → Source** to **GitHub Actions**.
3. Push to `main` or run **Actions → Deploy Telegram Mini App → Run workflow**.
4. After the first successful workflow, GitHub Pages will show the app URL.

Expected project URL:

`https://morofhamoi-debug.github.io/aaa/`

## Telegram bot setup

After GitHub Pages is active:

1. Open BotFather and configure the bot's Mini App / menu button URL to the Pages URL.
2. Open the Mini App from Telegram, not from a normal browser tab.
3. Telegram supplies the identity data; the server verifies it before creating the user session.

The Mini App will not authenticate a user outside Telegram because there is no Telegram initData there.

## Owner admin access

The database has a legacy admin record, but no Telegram account was linked to it when the app was prepared. The first Telegram login must **not** automatically become an administrator.

After the owner opens the Mini App, the Telegram ID is shown in Settings. Link that exact Telegram account to the existing owner admin record before using the admin panel. Do not grant admin access by changing a frontend flag.

## Trading model

The wallet uses internal demo credits. There is no deposit, cash withdrawal or real-money payment integration.

- All wallet and trade mutations are performed through server-side database functions.
- Buy requests reserve funds; cancelling or restricting an account releases reserved amounts.
- A trade transfers a specific collectible instance and appends the balance ledger.
- The configured marketplace fee is deducted from the seller proceeds and recorded separately.
- Candles are aggregated from completed trades only.
