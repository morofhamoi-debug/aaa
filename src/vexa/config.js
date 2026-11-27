export const VEXA = Object.freeze({
  name: 'VEXA',
  supabaseUrl: 'https://jdcypiuvykyfqfyllsji.supabase.co',
  publishableKey: 'sb_publishable_IcJxkmFEWoStId92rWR_jA_Kv09UfgF',
  marketFunction: 'market-api',
  storageBucket: 'market-assets',
  modelMaxBytes: 25 * 1024 * 1024,
  pageSize: 48
});

export const NAV_ITEMS = Object.freeze([
  { id: 'home', label: 'Обзор', icon: '⌂' },
  { id: 'market', label: 'Маркет', icon: '◈' },
  { id: 'portfolio', label: 'Портфель', icon: '▦', auth: true },
  { id: 'activity', label: 'Активность', icon: '↗', auth: true }
]);
