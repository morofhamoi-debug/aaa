import { createClient } from '@supabase/supabase-js';
import { VEXA } from './config.js';

export const supabase = createClient(VEXA.supabaseUrl, VEXA.publishableKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  },
  global: { headers: { 'X-Client-Info': 'vexa-web/1.0' } }
});

function normalizeError(error) {
  const message = (typeof error === 'string' ? error : error?.message) || 'Не удалось выполнить запрос';
  if (/Invalid login credentials/i.test(message)) return new Error('Неверная почта или пароль');
  if (/User already registered/i.test(message)) return new Error('Этот адрес уже зарегистрирован');
  if (/Password should be at least/i.test(message)) return new Error('Пароль должен содержать не менее 8 символов');
  if (/Email not confirmed/i.test(message)) return new Error('Сначала подтверди адрес электронной почты по ссылке из письма');
  if (/Invalid email/i.test(message)) return new Error('Проверь правильность адреса электронной почты');
  if (/email rate limit exceeded|too many requests/i.test(message)) return new Error('Слишком много попыток. Подожди немного и попробуй снова');
  if (/redirect.*not allowed|not a valid redirect/i.test(message)) return new Error('Адрес возврата VEXA не разрешён в настройках Supabase Auth');
  if (/duplicate key|market_profiles_handle_key/i.test(message)) return new Error('Это имя пользователя уже занято');
  if (/Failed to fetch|NetworkError/i.test(message)) return new Error('Нет соединения с сервером. Проверьте интернет и повторите попытку.');
  return new Error(message);
}

async function unwrap(query) {
  const { data, error } = await query;
  if (error) throw normalizeError(error);
  return data;
}

export async function callMarket(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke(VEXA.marketFunction, {
    body: { action, ...payload }
  });
  if (error) throw normalizeError(error);
  if (data?.error) throw normalizeError(data.error);
  return data?.data ?? data;
}

export async function exchangeTelegramInitData(initData) {
  if (typeof initData !== 'string' || !initData.trim()) {
    throw new Error('Telegram не передал данные Mini App. Открой VEXA из Telegram-бота.');
  }
  const { data, error } = await supabase.functions.invoke(VEXA.telegramAuthFunction, {
    body: { init_data: initData }
  });
  if (error) throw normalizeError(error);
  if (data?.error) throw normalizeError(data.error);
  if (!data?.token_hash) throw new Error('Telegram не вернул токен входа. Попробуй ещё раз.');
  return data;
}

export async function verifyTelegramSession(tokenHash) {
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'email'
  });
  if (error) throw normalizeError(error);
  return data;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw normalizeError(error);
  return data.session;
}

export async function signUp({ email, password, username, displayName }) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: { username, display_name: displayName || username },
      emailRedirectTo: window.location.origin + window.location.pathname
    }
  });
  if (error) throw normalizeError(error);
  return data;
}

export async function resendSignupConfirmation(email) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: window.location.origin + window.location.pathname
    }
  });
  if (error) throw normalizeError(error);
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password
  });
  if (error) throw normalizeError(error);
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw normalizeError(error);
}

export async function sendPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: window.location.origin + window.location.pathname
  });
  if (error) throw normalizeError(error);
}

export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw normalizeError(error);
}

export async function getProfile(userId) {
  return unwrap(supabase.from('market_profiles')
    .select('id,handle,display_name,avatar_url,bio,created_at')
    .eq('id', userId).maybeSingle());
}

export async function getWallet(userId) {
  return unwrap(supabase.from('market_wallets')
    .select('user_id,balance,reserved_balance,currency_code,updated_at')
    .eq('user_id', userId).maybeSingle());
}

export async function getCollections() {
  return unwrap(supabase.from('market_collections')
    .select('id,slug,name,description,cover_url,status,created_at')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(VEXA.pageSize));
}

export async function getVariants({ search = '', collectionId = '', rarity = '', offset = 0 } = {}) {
  let query = supabase.from('market_assets')
    .select('id,collection_id,gift_type_id,name,description,image_url,metadata,rarity,max_supply,initial_price,model_url,model_format,created_at,market_collections(name,slug),market_gift_types(name)')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(VEXA.pageSize);
  if (search.trim()) query = query.ilike('name', `%${search.trim().replace(/[%_]/g, '')}%`);
  if (collectionId) query = query.eq('collection_id', collectionId);
  if (rarity) query = query.eq('rarity', rarity);
  return unwrap(query.range(offset, offset + VEXA.pageSize - 1));
}

export async function getListings({ assetId = null, mine = false, userId = null } = {}) {
  let query = supabase.from('market_orders')
    .select('id,user_id,collectible_id,price,created_at,market_collectibles!inner(id,serial_number,owner_id,asset_id,market_assets!inner(id,name,rarity,image_url,model_url,collection_id))')
    .eq('side', 'sell')
    .eq('status', 'open')
    .order('price', { ascending: true })
    .limit(120);
  if (assetId) query = query.eq('market_collectibles.asset_id', assetId);
  if (mine && userId) query = query.eq('user_id', userId);
  return unwrap(query);
}

export async function getPortfolio(userId) {
  return unwrap(supabase.from('market_collectibles')
    .select('id,asset_id,serial_number,owner_id,minted_at,created_at,market_assets!inner(id,name,rarity,image_url,model_url,initial_price,max_supply,collection_id,market_collections(name,slug),market_gift_types(name))')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })
    .limit(200));
}

export async function getMyOrders(userId) {
  return unwrap(supabase.from('market_orders')
    .select('id,collectible_id,side,price,status,reserved_amount,created_at,updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100));
}

export async function getCandles(assetId, timeframe = '1h') {
  const validTimeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];
  if (!validTimeframes.includes(timeframe)) throw new Error('Недопустимый таймфрейм');
  const rows = await unwrap(supabase.from('market_price_candles')
    .select('bucket,open_price,high_price,low_price,close_price,volume,trade_count')
    .eq('asset_id', assetId)
    .eq('timeframe', timeframe)
    .order('bucket', { ascending: false })
    .limit(120));
  return (rows || []).reverse();
}

export async function getTrades({ assetId = null, limit = 30 } = {}) {
  let query = supabase.from('market_trades')
    .select('id,collectible_id,buyer_id,seller_id,price,fee,created_at,market_collectibles!inner(asset_id,serial_number,market_assets!inner(name,rarity))')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (assetId) query = query.eq('market_collectibles.asset_id', assetId);
  return unwrap(query);
}

export async function getFavorites(userId) {
  return unwrap(supabase.from('market_favorites')
    .select('asset_id,created_at')
    .eq('user_id', userId));
}

export async function getFavoriteVariants(userId) {
  const favorites = await getFavorites(userId);
  const ids = (favorites || []).map((item) => item.asset_id);
  if (!ids.length) return [];
  return unwrap(supabase.from('market_assets')
    .select('id,collection_id,gift_type_id,name,description,image_url,metadata,rarity,max_supply,initial_price,model_url,model_format,created_at,market_collections(name,slug),market_gift_types(name)')
    .eq('status', 'published')
    .in('id', ids));
}

export async function setFavorite(userId, assetId, enabled) {
  if (enabled) {
    return unwrap(supabase.from('market_favorites')
      .upsert({ user_id: userId, asset_id: assetId }, { onConflict: 'user_id,asset_id' })
      .select().single());
  }
  return unwrap(supabase.from('market_favorites')
    .delete().eq('user_id', userId).eq('asset_id', assetId));
}

export async function getNotifications(userId) {
  return unwrap(supabase.from('market_notifications')
    .select('id,notification_type,title,body,payload,read_at,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50));
}

export async function markNotificationRead(notificationId) {
  return callMarket('notification_read', { notification_id: notificationId });
}

export async function getExchangeRate() {
  return callMarket('get_fx_rate');
}

export async function submitOrder({ collectibleId, side, price }) {
  return callMarket('submit_order', {
    collectible_id: collectibleId,
    side,
    price: Number(price),
    idempotency_key: crypto.randomUUID()
  });
}

export async function cancelOrder(orderId) {
  return callMarket('cancel_order', { order_id: orderId });
}

export async function checkAdmin() {
  return Boolean(await callMarket('admin_check'));
}

export async function getAdminOverview() {
  return callMarket('admin_overview');
}

export async function getAdminSettings() {
  return callMarket('admin_get_settings');
}

export async function getAdminCatalog() {
  return callMarket('admin_catalog');
}

export async function getPublicStats() {
  const [collections, assets, trades] = await Promise.all([
    supabase.from('market_collections').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('market_assets').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('market_trades').select('id', { count: 'exact', head: true })
  ]);
  if (collections.error) throw normalizeError(collections.error);
  if (assets.error) throw normalizeError(assets.error);
  if (trades.error) throw normalizeError(trades.error);
  return { collections: collections.count || 0, variants: assets.count || 0, trades: trades.count || 0 };
}

export async function listAdminUsers(search = '') {
  return callMarket('admin_users', { search });
}

export async function createCollection(payload) {
  return callMarket('admin_create_collection', payload);
}

export async function createGiftType(payload) {
  return callMarket('admin_create_gift_type', payload);
}

export async function createVariant(payload) {
  return callMarket('admin_create_variant', payload);
}

export async function adjustBalance(payload) {
  return callMarket('admin_adjust_balance', payload);
}

export async function updateMarketSettings(payload) {
  return callMarket('admin_update_settings', payload);
}

export async function uploadModel(file, userId) {
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith('.glb')) {
    throw new Error('Можно загрузить только файл .glb');
  }
  if (file.size < 12 || file.size > VEXA.modelMaxBytes) {
    throw new Error('Размер GLB должен быть не больше 25 МБ');
  }
  const header = new DataView(await file.slice(0, 12).arrayBuffer());
  const magic = header.getUint32(0, true);
  const version = header.getUint32(4, true);
  const declaredLength = header.getUint32(8, true);
  if (magic !== 0x46546c67 || version !== 2 || declaredLength !== file.size) {
    throw new Error('Файл не является корректной бинарной GLB-моделью версии 2');
  }
  const path = `models/${userId}/${crypto.randomUUID()}.glb`;
  const { error } = await supabase.storage.from(VEXA.storageBucket).upload(path, file, {
    contentType: 'model/gltf-binary',
    cacheControl: '3600',
    upsert: false
  });
  if (error) throw normalizeError(error);
  const { data } = supabase.storage.from(VEXA.storageBucket).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl, size: file.size };
}

export function subscribeToAuth(callback) {
  return supabase.auth.onAuthStateChange((event, session) => callback(event, session));
}

export function subscribeToMarket(callback) {
  const channel = supabase.channel('vexa-market-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'market_orders' }, callback)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'market_trades' }, callback)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
