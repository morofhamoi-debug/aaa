export function formatBalance(value, currency = 'RUB', rubPerUsd = null) {
  const numeric = Number(value ?? 0);
  const converted = currency === 'USD' && Number.isFinite(rubPerUsd) && rubPerUsd > 0
    ? numeric / rubPerUsd
    : numeric;
  return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(converted);
}

export function formatPrice(value, currency = 'RUB', rubPerUsd = null) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return formatBalance(value, currency, rubPerUsd);
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

export function formatRelative(value) {
  if (!value) return '—';
  const date = new Date(value);
  const delta = Date.now() - date.getTime();
  if (!Number.isFinite(delta)) return '—';
  if (delta < 60_000) return 'Только что';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} мин. назад`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)} ч. назад`;
  return formatDate(value);
}

export function slugify(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72);
}

export function isValidHandle(value) {
  return /^[a-zA-Z0-9_]{3,24}$/.test(String(value ?? ''));
}

export function safeText(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function rarityClass(value) {
  const normalized = String(value ?? '').toLowerCase();
  if (/(myth|миф)/.test(normalized)) return 'mythic';
  if (/(legend|легенд)/.test(normalized)) return 'legendary';
  if (/(epic|эпич)/.test(normalized)) return 'epic';
  if (/(rare|редк)/.test(normalized)) return 'rare';
  return 'common';
}
