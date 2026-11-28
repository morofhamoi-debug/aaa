import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

const encoder = new TextEncoder();

async function hmacSha256(keyBytes: Uint8Array, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function hexToBytes(value: string) {
  if (!/^[0-9a-f]{64}$/i.test(value)) return null;
  const bytes = new Uint8Array(32);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function verifyInitData(raw: string, botToken: string) {
  if (!raw || raw.length > 16_384) throw new Error("Invalid Telegram data");
  const params = new URLSearchParams(raw);
  const values = new Map<string, string>();

  for (const [key, value] of params.entries()) {
    if (values.has(key)) throw new Error("Invalid Telegram data");
    values.set(key, value);
  }

  const receivedHash = values.get("hash") || "";
  const suppliedHash = hexToBytes(receivedHash);
  const authDate = Number(values.get("auth_date"));
  const now = Math.floor(Date.now() / 1000);

  if (!suppliedHash || !Number.isSafeInteger(authDate) ||
      authDate > now + 60 || now - authDate > 15 * 60) {
    throw new Error("Telegram session expired. Reopen the Mini App from Telegram.");
  }

  const checkString = [...values.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  // Telegram Mini Apps: secret_key = HMAC_SHA256(key="WebAppData", message=bot_token)
  const secretKey = await hmacSha256(encoder.encode("WebAppData"), botToken);
  const expectedHash = await hmacSha256(secretKey, checkString);
  if (!constantTimeEqual(expectedHash, suppliedHash)) {
    throw new Error("Telegram signature is invalid");
  }

  const rawUser = values.get("user");
  if (!rawUser || rawUser.length > 4096) throw new Error("Telegram user data is missing");

  let telegramUser: any;
  try { telegramUser = JSON.parse(rawUser); } catch { throw new Error('Invalid Telegram data'); }
  if (!Number.isSafeInteger(telegramUser?.id) ||
      telegramUser.id <= 0 ||
      telegramUser.id > 4_503_599_627_370_495) {
    throw new Error("Telegram user ID is invalid");
  }

  const firstName = String(telegramUser.first_name || "").trim().slice(0, 64);
  const lastName = String(telegramUser.last_name || "").trim().slice(0, 64);
  if (!firstName) throw new Error("Telegram account has no first name");

  const username = typeof telegramUser.username === "string" &&
    /^[A-Za-z0-9_]{5,32}$/.test(telegramUser.username)
      ? telegramUser.username
      : null;

  let photoUrl: string | null = null;
  if (typeof telegramUser.photo_url === "string" && telegramUser.photo_url.length <= 2048) {
    try {
      const url = new URL(telegramUser.photo_url);
      if (url.protocol === "https:" && url.hostname === "t.me") photoUrl = url.toString();
    } catch {
      photoUrl = null;
    }
  }

  return {
    id: String(telegramUser.id),
    username,
    firstName,
    lastName,
    photoUrl,
    displayName: [firstName, lastName].filter(Boolean).join(" ").slice(0, 60),
    authHash: receivedHash.toLowerCase(),
    authDate,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    let serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    try {
      const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
      serviceKey = secretKeys.default || serviceKey;
    } catch {
      // Fall back to the legacy service-role environment variable when present.
    }

    if (!botToken || !supabaseUrl || !serviceKey) {
      return json({ error: "Telegram sign-in is not configured on the server yet" }, 503);
    }

    const body = await req.json().catch(() => null);
    const initData = typeof body?.init_data === "string" ? body.init_data : "";
    const telegram = await verifyInitData(initData, botToken);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Remove expired hashes occasionally, then atomically claim this signed
    // initData hash. The unique key rejects replayed Telegram launch payloads.
    await admin.from("market_telegram_auth_nonces")
      .delete()
      .lt("expires_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

    const { error: nonceError } = await admin
      .from("market_telegram_auth_nonces")
      .insert({
        auth_hash: telegram.authHash,
        expires_at: new Date((telegram.authDate + 15 * 60) * 1000).toISOString(),
      });
    if (nonceError?.code === "23505") {
      return json({ error: "Telegram session was already used. Reopen the Mini App from Telegram." }, 409);
    }
    if (nonceError) throw nonceError;

    const syntheticEmail = `tg_${telegram.id}@telegram.vexa.invalid`;
    const fallbackHandle = `tg_${telegram.id}`;

    const { data: linked, error: linkedError } = await admin
      .from("market_telegram_accounts")
      .select("user_id")
      .eq("telegram_id", telegram.id)
      .maybeSingle();
    if (linkedError) throw linkedError;

    let authUser: any = null;
    if (linked?.user_id) {
      const { data, error } = await admin.auth.admin.getUserById(linked.user_id);
      if (error) throw error;
      authUser = data.user;
    }

    // Recover safely if an earlier request created the Auth user but failed before
    // inserting the Telegram mapping row.
    if (!authUser) {
      const { data: page, error: listError } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (listError) throw listError;
      authUser = (page.users || []).find((user: any) =>
        String(user.email || "").toLowerCase() === syntheticEmail
      ) || null;
    }

    if (!authUser) {
      const { data, error } = await admin.auth.admin.createUser({
        email: syntheticEmail,
        email_confirm: true,
        user_metadata: {
          username: fallbackHandle,
          display_name: telegram.displayName,
          name: telegram.displayName,
          telegram_username: telegram.username,
          avatar_url: telegram.photoUrl,
        },
        app_metadata: {
          provider: "email",
          providers: ["email"],
          telegram_id: telegram.id,
          telegram_username: telegram.username,
          telegram_first_name: telegram.firstName,
          telegram_last_name: telegram.lastName,
          telegram_photo_url: telegram.photoUrl,
        },
      });
      if (error) {
        const { data: recovered, error: recoverError } = await admin.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        if (recoverError) throw error;
        authUser = (recovered.users || []).find((user: any) =>
          String(user.email || "").toLowerCase() === syntheticEmail
        ) || null;
        if (!authUser) throw error;
      } else {
        authUser = data.user;
      }
    } else {
      const { data, error } = await admin.auth.admin.updateUserById(authUser.id, {
        user_metadata: {
          ...(authUser.user_metadata || {}),
          username: authUser.user_metadata?.username || fallbackHandle,
          display_name: telegram.displayName,
          name: telegram.displayName,
          telegram_username: telegram.username,
          avatar_url: telegram.photoUrl,
        },
        app_metadata: {
          ...(authUser.app_metadata || {}),
          telegram_id: telegram.id,
          telegram_username: telegram.username,
          telegram_first_name: telegram.firstName,
          telegram_last_name: telegram.lastName,
          telegram_photo_url: telegram.photoUrl,
        },
      });
      if (error) throw error;
      authUser = data.user;
    }

    const profilePatch: Record<string, unknown> = {
      display_name: telegram.displayName,
    };
    if (telegram.photoUrl) profilePatch.avatar_url = telegram.photoUrl;

    // Prefer the Telegram username as the public VEXA handle when it fits
    // the marketplace handle rules and is not already owned by another user.
    if (telegram.username && telegram.username.length <= 24) {
      const { data: handleOwner, error: handleError } = await admin
        .from("market_profiles")
        .select("id")
        .eq("handle", telegram.username)
        .maybeSingle();
      if (handleError) throw handleError;
      if (!handleOwner || handleOwner.id === authUser.id) {
        profilePatch.handle = telegram.username;
      }
    }

    const { error: profileError } = await admin
      .from("market_profiles")
      .update(profilePatch)
      .eq("id", authUser.id);
    if (profileError) throw profileError;

    const { error: mappingError } = await admin
      .from("market_telegram_accounts")
      .upsert({
        telegram_id: telegram.id,
        user_id: authUser.id,
        telegram_username: telegram.username,
        first_name: telegram.firstName,
        last_name: telegram.lastName || null,
        photo_url: telegram.photoUrl,
        updated_at: new Date().toISOString(),
      }, { onConflict: "telegram_id" });
    if (mappingError) throw mappingError;

    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: syntheticEmail,
    });
    if (linkError) throw linkError;

    const tokenHash = link?.properties?.hashed_token;
    if (!tokenHash) throw new Error("Could not create a Telegram session");

    return json({
      ok: true,
      token_hash: tokenHash,
      profile: {
        telegram_id: telegram.id,
        username: telegram.username,
        first_name: telegram.firstName,
        last_name: telegram.lastName,
        photo_url: telegram.photoUrl,
        display_name: telegram.displayName,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Telegram authentication failed";
    const authFailure = [
      "Invalid Telegram data",
      "Telegram signature is invalid",
      "Telegram session expired. Reopen the Mini App from Telegram.",
      "Telegram user data is missing",
      "Telegram user ID is invalid",
      "Telegram account has no first name",
    ].includes(message);
    const replayFailure = message === "Telegram session was already used. Reopen the Mini App from Telegram.";
    const safeMessage = authFailure || replayFailure ? message : "Unable to sign in with Telegram";
    return json({ error: safeMessage }, authFailure ? 401 : replayFailure ? 409 : 500);
  }
});
