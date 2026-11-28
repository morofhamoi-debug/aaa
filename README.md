# VEXA — Digital Collectibles Marketplace

VEXA is a responsive digital collectibles marketplace built with Vite, Three.js and Supabase. It uses an internal test economy only: there are no real-money deposits or withdrawals, payment cards, blockchain tokens or smart contracts.

## Current implementation

- Supabase email/password authentication and email confirmation flow.
- Server-created profiles and wallets with a starting balance of **0**.
- Published collections, base gift types and rarity variants.
- Unique internal collectibles, supply limits and server-side minting.
- GLB uploads to the `market-assets` Storage bucket and browser 3D viewing with Three.js.
- Live sell listings, buy/sell order submission, cancellation and atomic matching through protected SQL RPCs.
- Internal wallet ledger, reserved balances, actual trade records and OHLC candle storage from executed trades.
- Portfolio, order history, favorites, notifications and profile settings.
- Server-checked administrator role, collection/gift/variant creation, virtual balance adjustments and admin audit log.
- Cached USD/RUB display rate fetched server-side from the Bank of Russia.
- Light/dark themes, responsive desktop/mobile navigation and GitHub Pages build workflow.

The UI does not create seed collectibles, fake trades, artificial trading volume or fictitious market metrics. An empty catalogue is expected until an administrator publishes actual items.

## Stack

- Vite 7
- JavaScript ES modules
- Three.js 0.182 / GLTFLoader / OrbitControls
- Supabase JS 2
- Supabase Auth, PostgreSQL, RLS, Edge Functions, Storage and Realtime

## Local development

Requirements: Node.js 20.19+ or 22.12+ and npm 10+.

```bash
npm install
npm run dev
```

Production checks:

```bash
npm run check
npm run build
npm run preview
```

The Vite build uses relative paths and is deployed by GitHub Actions to GitHub Pages. The repository still contains the original FPS source modules in `src/core`, `src/player`, `src/world` and `src/weapons`; they have not been deleted. VEXA is now the root application.

## Supabase project

The frontend uses only the project's public publishable key from `src/vexa/config.js`. It is not a service-role key. Never add a service-role or secret key to the frontend.

The database migrations applied to the connected project are stored in `supabase/migrations/`. The initial marketplace migrations pre-existed this VEXA work and were preserved.

### First administrator

Admin access is **not** granted by email address, username or client-side state. After registering and confirming your own account, an existing project owner must grant your user UUID from the trusted SQL editor:

```sql
insert into private.market_admins (user_id)
values ('YOUR_AUTH_USER_UUID'::uuid)
on conflict (user_id) do nothing;
```

Get the UUID from the Supabase Auth users page. Do not execute this from the browser. The admin role is then checked by the Edge Function on every administrative request.

### Auth configuration

In Supabase Authentication settings, configure the site URL and redirect allowlist for the deployed GitHub Pages URL and your local development URL. Email confirmation and password recovery require a functioning email provider; configure custom SMTP before production use.

## Economy and trading notes

- The wallet stores integer internal VEX units; the ₽/$ control changes display only.
- Each new wallet starts with zero balance.
- The Bank of Russia USD/RUB rate is fetched and cached by the Edge Function; a last-known rate is used on provider failure.
- Buy orders reserve available balance. Cancelling an open buy order releases the reservation.
- Order matching, balance updates, ownership transfer, ledger writes and trade records are performed by the database trading function.
- Trades and volume are derived only from actual executed orders.

**Known staged items:** fee collection is kept at 0 until commission calculation is integrated into the atomic matching SQL function; the current admin control can pause/resume trading. Historical market indicators are shown only from stored executions. Additional candle rollups, advanced chart UI, email notifications, moderation tools, and full admin collection/user-edit workflows remain staged work.

## Security notes

- Public client access is restricted by RLS.
- Wallets and ledger are owner-readable; client roles have no direct wallet write access.
- Admin RPCs execute only through the authenticated Edge Function and verify membership in `private.market_admins`.
- Model uploads are restricted to administrator users and the `models/` storage folder.
- Trading requests derive the actor from the verified Supabase session, not from a browser-supplied user id.
- The project has no real-money or blockchain integration.


## Telegram Mini App sign-in

VEXA supports email sign-in and Telegram Mini App sign-in. Telegram identity data is accepted only from the signed `Telegram.WebApp.initData` payload. The `telegram-auth` Edge Function verifies Telegram's HMAC signature and the `auth_date` freshness before creating or reusing a Supabase user. Telegram IDs are stored in `market_telegram_accounts`, a table accessible only to the server role. The profile uses the Telegram display name, username and profile photo.

### Connect your bot

1. Create the bot in **@BotFather** and create/configure its Mini App. Set the Mini App URL to `https://morofhamoi-debug.github.io/aaa/`.
2. In Supabase Dashboard open **Edge Functions → Secrets** and add `TELEGRAM_BOT_TOKEN` with the token from BotFather. Never put this token in frontend code or GitHub.
3. In `src/vexa/config.js`, set `telegramBotUsername` to the bot username without the leading `@`.
4. Open VEXA from the bot's Mini App button in Telegram. Telegram authentication is not available from an ordinary browser tab because the browser does not provide signed Mini App data.

The email login and registration flow remains available separately.
