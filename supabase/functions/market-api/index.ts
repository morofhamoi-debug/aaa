import { withSupabase } from "npm:@supabase/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validText(value: unknown, max = 500) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= max;
}

async function requireAdmin(ctx: any, actorId: string) {
  const { data, error } = await ctx.supabaseAdmin.rpc("market_admin_is_authorized", {
    p_actor_id: actorId,
  });
  if (error) throw error;
  if (data !== true) {
    const err = new Error("Administrator access required");
    (err as any).status = 403;
    throw err;
  }
}

async function getRate(ctx: any) {
  const { data: cached, error: cacheError } = await ctx.supabaseAdmin
    .from("market_exchange_rates")
    .select("rate,source,fetched_at,source_date")
    .eq("base_currency", "USD")
    .eq("quote_currency", "RUB")
    .maybeSingle();
  if (cacheError) throw cacheError;

  const cacheTime = cached?.fetched_at ? new Date(cached.fetched_at).getTime() : 0;
  const fresh = cacheTime > 0 && Date.now() - cacheTime < 2 * 60 * 60 * 1000;
  if (fresh) {
    return {
      rub_per_usd: Number(cached.rate),
      source: cached.source,
      fetched_at: cached.fetched_at,
      source_date: cached.source_date,
      stale: false,
    };
  }

  try {
    const upstream = await fetch("https://www.cbr.ru/scripts/XML_daily.asp", {
      headers: { "User-Agent": "VEXA-Market/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) throw new Error("Rate provider unavailable");
    const bytes = await upstream.arrayBuffer();
    const xml = new TextDecoder("windows-1251").decode(bytes);
    const usdRecord = xml.match(/<Valute\b[^>]*>[\s\S]*?<CharCode>USD<\/CharCode>[\s\S]*?<Nominal>\s*1\s*<\/Nominal>[\s\S]*?<Value>([^<]+)<\/Value>[\s\S]*?<\/Valute>/i);
    if (!usdRecord?.[1]) throw new Error("USD rate missing from provider response");
    const rate = Number(usdRecord[1].replace(",", ".").replace(/\s/g, ""));
    if (!Number.isFinite(rate) || rate <= 0) throw new Error("Invalid rate provider response");

    const fetchedAt = new Date().toISOString();
    const sourceDateMatch = xml.match(/<ValCurs\b[^>]*Date="([^"]+)"/i);
    const sourceDateRaw = sourceDateMatch?.[1] || "";
    const sourceDateParts = sourceDateRaw.split(".");
    const sourceDate = sourceDateParts.length === 3
      ? `${sourceDateParts[2]}-${sourceDateParts[1]}-${sourceDateParts[0]}`
      : fetchedAt.slice(0, 10);

    const { error: saveError } = await ctx.supabaseAdmin
      .from("market_exchange_rates")
      .upsert({
        base_currency: "USD",
        quote_currency: "RUB",
        rate,
        source: "Bank of Russia",
        source_date: sourceDate,
        fetched_at: fetchedAt,
      }, { onConflict: "base_currency,quote_currency" });
    if (saveError) throw saveError;

    return {
      rub_per_usd: rate,
      source: "Bank of Russia",
      fetched_at: fetchedAt,
      source_date: sourceDate,
      stale: false,
    };
  } catch (error) {
    if (cached?.rate) {
      return {
        rub_per_usd: Number(cached.rate),
        source: cached.source,
        fetched_at: cached.fetched_at,
        source_date: cached.source_date,
        stale: true,
      };
    }
    throw error;
  }
}

const handler = withSupabase({ auth: "user" }, async (req, ctx) => {
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const actorId = ctx.userClaims?.sub;
    if (!actorId || !isUuid(actorId)) return response({ error: "Authentication required" }, 401);

    const action = body?.action;
    let result: unknown;

    if (action === "get_fx_rate") {
      result = await getRate(ctx);
    } else if (action === "submit_order") {
      const price = body.price;
      if (
        !isUuid(body.collectible_id) ||
        !isUuid(body.idempotency_key) ||
        !["buy", "sell"].includes(body.side) ||
        !["collectible", "asset"].includes(body.scope || "collectible") ||
        (body.side === "sell" && body.scope === "asset") ||
        !Number.isSafeInteger(price) || price <= 0 || price > 9000000000000000
      ) {
        return response({ error: "Invalid order parameters" }, 400);
      }
      const { data: accessStatus, error: accessError } =
        await ctx.supabaseAdmin.rpc("market_user_access_status", { p_actor_id: actorId });
      if (accessError) throw accessError;
      if (accessStatus?.can_trade !== true) {
        return response({ error: "Trading is not available for this account" }, 403);
      }
      if (body.side === "sell" && accessStatus?.can_list !== true) {
        return response({ error: "Listing is not available for this account" }, 403);
      }
      const { data: marketStatus, error: statusError } =
        await ctx.supabaseAdmin.rpc("market_get_market_status");
      if (statusError) throw statusError;
      if (marketStatus?.trading_enabled !== true) {
        return response({ error: "Trading is paused" }, 409);
      }
      const { data, error } = await ctx.supabaseAdmin.rpc("market_submit_order_v2", {
        p_actor_id: actorId,
        p_collectible_id: body.collectible_id,
        p_side: body.side,
        p_price: price,
        p_idempotency_key: body.idempotency_key,
        p_scope: body.scope || "collectible",
      });
      if (error) throw error;
      result = data;
    } else if (action === "cancel_order") {
      if (!isUuid(body.order_id)) return response({ error: "Invalid order ID" }, 400);
      const { data, error } = await ctx.supabaseAdmin.rpc("market_cancel_order", {
        p_actor_id: actorId,
        p_order_id: body.order_id,
      });
      if (error) throw error;
      result = data;
    } else if (action === "admin_check") {
      const { data, error } = await ctx.supabaseAdmin.rpc("market_admin_is_authorized", {
        p_actor_id: actorId,
      });
      if (error) throw error;
      result = data === true;
    } else if (action.startsWith("admin_")) {
      await requireAdmin(ctx, actorId);

      if (action === "admin_overview") {
        const { data, error } = await ctx.supabaseAdmin.rpc("market_admin_overview", {
          p_actor_id: actorId,
        });
        if (error) throw error;
        result = data;
      } else if (action === "admin_get_settings") {
        const { data, error } = await ctx.supabaseAdmin.rpc("market_get_market_status");
        if (error) throw error;
        result = data;
      } else if (action === "admin_catalog") {
        const [collections, gifts, variants] = await Promise.all([
          ctx.supabaseAdmin.from("market_collections")
            .select("id,slug,name,description,cover_url,status,created_at")
            .order("created_at", { ascending: false }).limit(200),
          ctx.supabaseAdmin.from("market_gift_types")
            .select("id,slug,name,collection_id,status,created_at")
            .order("created_at", { ascending: false }).limit(300),
          ctx.supabaseAdmin.from("market_assets")
            .select("id,name,rarity,status,max_supply,initial_price,gift_type_id,created_at")
            .order("created_at", { ascending: false }).limit(500),
        ]);
        if (collections.error) throw collections.error;
        if (gifts.error) throw gifts.error;
        if (variants.error) throw variants.error;
        result = {
          collections: collections.data || [],
          gift_types: gifts.data || [],
          variants: variants.data || [],
        };
      } else if (action === "admin_set_catalog_status") {
        if (!isUuid(body.target_id) ||
            !["collection","gift_type","asset"].includes(body.target_type) ||
            !["draft","published","archived"].includes(body.status)) {
          return response({ error: "Invalid catalog status" }, 400);
        }
        const { data, error } = await ctx.supabaseAdmin.rpc("market_admin_set_catalog_status", {
          p_actor_id: actorId,
          p_target_type: body.target_type,
          p_target_id: body.target_id,
          p_status: body.status,
        });
        if (error) throw error;
        result = data;
      } else if (action === "admin_create_collection") {
        if (!validText(body.name, 80) || !validText(body.slug, 80) ||
            !["draft", "published"].includes(body.status)) {
          return response({ error: "Invalid collection fields" }, 400);
        }
        const { data, error } = await ctx.supabaseAdmin.rpc("market_admin_create_collection", {
          p_actor_id: actorId, p_name: body.name.trim(), p_slug: body.slug.trim(),
          p_description: validText(body.description, 2000) ? body.description.trim() : null,
          p_cover_url: validText(body.cover_url, 2048) ? body.cover_url.trim() : null,
          p_status: body.status,
        });
        if (error) throw error;
        result = data;
      } else if (action === "admin_create_gift_type") {
        if (!isUuid(body.collection_id) || !validText(body.name, 80) ||
            !validText(body.slug, 80) || !["draft", "published"].includes(body.status)) {
          return response({ error: "Invalid gift fields" }, 400);
        }
        const { data, error } = await ctx.supabaseAdmin.rpc("market_admin_create_gift_type", {
          p_actor_id: actorId, p_collection_id: body.collection_id,
          p_name: body.name.trim(), p_slug: body.slug.trim(),
          p_description: validText(body.description, 2000) ? body.description.trim() : null,
          p_cover_url: validText(body.cover_url, 2048) ? body.cover_url.trim() : null,
          p_status: body.status,
        });
        if (error) throw error;
        result = data;
      } else if (action === "admin_create_variant") {
        const price = body.initial_price;
        const maxSupply = body.max_supply;
        const mintQuantity = body.mint_quantity;
        if (
          !isUuid(body.gift_type_id) || !validText(body.name, 120) ||
          !validText(body.rarity, 40) ||
          !Number.isSafeInteger(price) || price < 0 ||
          !Number.isSafeInteger(maxSupply) || maxSupply < 1 ||
          !Number.isSafeInteger(mintQuantity) || mintQuantity < 0 || mintQuantity > maxSupply ||
          !["draft", "published"].includes(body.status) ||
          (body.model_url && !String(body.model_url).startsWith("https://"))
        ) {
          return response({ error: "Invalid variant parameters" }, 400);
        }
        const { data, error } = await ctx.supabaseAdmin.rpc("market_admin_create_variant", {
          p_actor_id: actorId, p_gift_type_id: body.gift_type_id,
          p_name: body.name.trim(), p_rarity: body.rarity.trim(),
          p_description: validText(body.description, 2000) ? body.description.trim() : null,
          p_image_url: validText(body.image_url, 2048) ? body.image_url.trim() : null,
          p_model_url: validText(body.model_url, 2048) ? body.model_url.trim() : null,
          p_model_size_bytes: Number.isSafeInteger(body.model_size_bytes) ? body.model_size_bytes : null,
          p_initial_price: price, p_max_supply: maxSupply, p_mint_quantity: mintQuantity,
          p_status: body.status,
        });
        if (error) throw error;
        result = data;
      } else if (action === "admin_mint_collectibles") {
        if (!isUuid(body.asset_id) || !Number.isSafeInteger(body.quantity) ||
            body.quantity < 1 || body.quantity > 1000) {
          return response({ error: "Invalid mint quantity" }, 400);
        }
        const { data, error } = await ctx.supabaseAdmin.rpc("market_admin_mint_collectibles", {
          p_actor_id: actorId, p_asset_id: body.asset_id, p_quantity: body.quantity,
        });
        if (error) throw error;
        result = data;
      } else if (action === "admin_adjust_balance") {
        if (!isUuid(body.user_id) || !Number.isSafeInteger(body.amount) ||
            body.amount === 0 || Math.abs(body.amount) > 1000000000 || !validText(body.reason, 500)) {
          return response({ error: "Invalid balance adjustment" }, 400);
        }
        const { data, error } = await ctx.supabaseAdmin.rpc("market_admin_adjust_balance", {
          p_actor_id: actorId, p_user_id: body.user_id,
          p_amount: body.amount, p_reason: body.reason.trim(),
        });
        if (error) throw error;
        result = data;
      } else if (action === "admin_update_settings") {
        const { data: current, error: currentError } =
          await ctx.supabaseAdmin.rpc("market_get_market_status");
        if (currentError) throw currentError;
        const tradingEnabled = typeof body.trading_enabled === "boolean"
          ? body.trading_enabled : current?.trading_enabled === true;
        const commissionBps = body.commission_bps === undefined
          ? Number(current?.commission_bps || 0) : body.commission_bps;
        if (!Number.isSafeInteger(commissionBps) || commissionBps < 0 || commissionBps > 1000) {
          return response({ error: "Invalid market settings" }, 400);
        }
        const { data, error } = await ctx.supabaseAdmin.rpc("market_admin_update_settings", {
          p_actor_id: actorId,
          p_trading_enabled: tradingEnabled,
          p_commission_bps: commissionBps,
        });
        if (error) throw error;
        result = data;
      } else if (action === "admin_users") {
        if (!validText(body.search, 120) || body.search.trim().length < 2) {
          return response({ error: "Введите не менее двух символов для поиска" }, 400);
        }
        const { data, error } = await ctx.supabaseAdmin.rpc("market_admin_search_users", {
          p_actor_id: actorId, p_search: body.search.trim(),
        });
        if (error) throw error;
        result = data || [];
      } else if (action === "admin_user_details") {
        if (!isUuid(body.user_id)) return response({ error: "Invalid user ID" }, 400);
        const { data, error } = await ctx.supabaseAdmin.rpc("market_admin_user_details", {
          p_actor_id: actorId, p_user_id: body.user_id,
        });
        if (error) throw error;
        result = data;
      } else if (action === "admin_set_restriction") {
        const types = ["full_access","trading","listing","wallet","collectibles"];
        const duration = body.duration_minutes === null || body.duration_minutes === undefined
          ? null : body.duration_minutes;
        if (!isUuid(body.user_id) || !types.includes(body.restriction_type) ||
            !validText(body.reason, 500) ||
            (duration !== null && (!Number.isSafeInteger(duration) || duration < 1 || duration > 525600))) {
          return response({ error: "Invalid restriction parameters" }, 400);
        }
        const { data, error } = await ctx.supabaseAdmin.rpc("market_admin_set_restriction", {
          p_actor_id: actorId, p_user_id: body.user_id,
          p_restriction_type: body.restriction_type,
          p_reason: body.reason.trim(), p_duration_minutes: duration,
        });
        if (error) throw error;
        result = data;
      } else if (action === "admin_lift_restrictions") {
        if (!isUuid(body.user_id)) return response({ error: "Invalid user ID" }, 400);
        const type = body.restriction_type ?? null;
        if (type !== null && !["full_access","trading","listing","wallet","collectibles"].includes(type)) {
          return response({ error: "Invalid restriction type" }, 400);
        }
        const { data, error } = await ctx.supabaseAdmin.rpc("market_admin_lift_restrictions", {
          p_actor_id: actorId, p_user_id: body.user_id, p_restriction_type: type,
        });
        if (error) throw error;
        result = data;
      } else if (action === "admin_audit") {
        const limit = Number.isSafeInteger(body.limit) ? body.limit : 50;
        const { data, error } = await ctx.supabaseAdmin.rpc("market_admin_recent_audit", {
          p_actor_id: actorId, p_limit: limit,
        });
        if (error) throw error;
        result = data || [];
      } else {
        return response({ error: "Unknown admin action" }, 400);
      }
    } else if (action === "get_access_status") {
      const { data, error } = await ctx.supabaseAdmin.rpc("market_user_access_status", {
        p_actor_id: actorId,
      });
      if (error) throw error;
      result = data;
    } else if (action === "notification_read") {
      if (!isUuid(body.notification_id)) return response({ error: "Invalid notification ID" }, 400);
      const { data, error } = await ctx.supabaseAdmin.rpc("market_mark_notification_read", {
        p_actor_id: actorId, p_notification_id: body.notification_id,
      });
      if (error) throw error;
      result = data;
    } else {
      return response({ error: "Unknown action" }, 400);
    }

    return response({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    const status = Number((error as any)?.status) || 400;
    const safeMessages = [
      "Insufficient available balance", "You do not own this collectible",
      "Seller no longer owns this collectible", "Order not found",
      "Only open orders can be cancelled", "Reserved balance mismatch",
      "Invalid order parameters", "Idempotency key reused with different request",
      "Request is already processing", "Administrator access required",
      "Trading is paused", "Invalid collection fields", "Collection not found",
      "Invalid gift fields", "Invalid variant parameters", "Mint quantity exceeds max supply",
      "Invalid balance adjustment", "Invalid market settings",
      "Invalid mint quantity", "Mint quantity exceeds max supply",
      "Invalid catalog status", "Catalog item not found",
      "Adjustment would spend reserved funds", "Invalid restriction parameters",
      "Trading is not available for this account", "Listing is not available for this account",
      "User not found", "Invalid user ID", "Invalid restriction type",
      "Введите не менее двух символов для поиска",
    ];
    const safe = safeMessages.includes(message)
      ? message
      : message === "Invalid UUID" ? message : "Unable to process request";
    return response({ error: safe }, status);
  }
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  return handler(req);
});
