export const VEXA = Object.freeze({
  name: 'VEXA',
  supabaseUrl: 'https://jdcypiuvykyfqfyllsji.supabase.co',
  publishableKey: 'sb_publishable_IcJxkmFEWoStId92rWR_jA_Kv09UfgF',
  marketFunction: 'market-api',
  telegramAuthFunction: 'telegram-auth',
  telegramBotUsername: '',
  storageBucket: 'market-assets',
  modelMaxBytes: 25 * 1024 * 1024,
  pageSize: 48
});

export const NAV_ITEMS = Object.freeze([
  { id: 'market', label: 'Маркет', icon: 'market' },
  { id: 'collections', label: 'Коллекции', icon: 'collections' },
  { id: 'portfolio', label: 'Мои NFT', icon: 'inventory', auth: true },
  { id: 'favorites', label: 'Избранное', icon: 'favorites', auth: true },
  { id: 'profile', label: 'Профиль', icon: 'user', auth: true }
]);
