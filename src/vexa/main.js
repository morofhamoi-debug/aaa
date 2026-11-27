import {
  callMarket, getSession, signUp, signIn, signOut, sendPasswordReset, updatePassword,
  getProfile, getWallet, getCollections, getVariants, getListings, getPortfolio, getFavoriteVariants,
  getMyOrders, getTrades, getFavorites, setFavorite, getNotifications,
  markNotificationRead, getExchangeRate, getCandles, submitOrder, cancelOrder, checkAdmin,
  getAdminOverview, getAdminSettings, getAdminCatalog, getPublicStats, listAdminUsers, createCollection, createGiftType,
  createVariant, adjustBalance, updateMarketSettings, uploadModel, subscribeToAuth,
  subscribeToMarket, supabase
} from './api.js';
import { mountGiftViewer } from './viewer.js';
import { drawCandles } from './chart.js';
import { formatBalance, formatPrice, formatDate, formatRelative, slugify, isValidHandle, safeText, rarityClass } from './utils.js';

const app = document.querySelector('#app');
const state = {
  session: null, user: null, profile: null, wallet: null, rate: null, currency: 'RUB', publicStats: { collections: 0, variants: 0, trades: 0 }, adminCollections: [],
  theme: localStorage.getItem('vexa-theme') === 'light' ? 'light' : 'dark',
  page: 'home', collections: [], variants: [], listings: [], trades: [], portfolio: [],
  myOrders: [], favorites: new Set(), notifications: [], admin: false, adminOverview: null,
  adminSettings: null, adminUsers: [], selectedAsset: null, detailListings: [], detailTrades: [], detailCandles: [], detailTimeframe: '1h',
  busy: false, viewerDispose: null, modal: null, catalogSearch: '', collectionFilter: '', rarityFilter: '',
  catalogSort: 'newest'
};

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);
const relation = (value) => Array.isArray(value) ? value[0] : value;
const safeUrl = (value) => /^https:\/\//i.test(String(value ?? '')) ? String(value) : '';
const initials = (value) => String(value || 'V').trim().slice(0, 1).toUpperCase();
const moneyLabel = () => state.currency === 'USD' ? '$' : '₽';
const getBalance = () => state.wallet?.balance ?? 0;
const rateValue = () => Number(state.rate?.rub_per_usd) > 0 ? Number(state.rate.rub_per_usd) : null;

function toast(message, type = 'info') {
  const node = document.querySelector('#toast');
  if (!node) return;
  node.textContent = message;
  node.dataset.type = type;
  node.classList.add('visible');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('visible'), 3600);
}

function disposeViewer() {
  if (state.viewerDispose) state.viewerDispose();
  state.viewerDispose = null;
}

function navButton(item) {
  return `<button class="nav-link ${state.page === item.id ? 'active' : ''}" data-action="navigate" data-page="${item.id}">
    <span class="nav-icon">${item.icon}</span><span>${item.label}</span>
  </button>`;
}

function headerHTML() {
  const signedIn = Boolean(state.user);
  const rateTitle = state.rate?.fetched_at
    ? `Курс Банка России: ${Number(rateValue()).toFixed(4)} ₽/$ · обновлён ${formatDate(state.rate.fetched_at)} ${state.rate.stale ? '· устаревшие данные' : ''}`
    : 'Курс USD/RUB пока недоступен';
  const balance = signedIn
    ? `<button class="balance-pill" data-action="currency" ${rateValue() ? '' : 'disabled'} title="${esc(rateTitle)}">
        <span class="balance-currency">${moneyLabel()}</span><strong>${formatBalance(getBalance(), state.currency, rateValue())}</strong>
      </button>`
    : '<button class="balance-pill guest-balance" data-action="login"><span>Войти</span><strong>в аккаунт</strong></button>';
  const account = signedIn
    ? `<button class="avatar-button" data-action="navigate" data-page="profile" aria-label="Профиль">${esc(initials(state.profile?.display_name || state.profile?.handle))}</button>`
    : '<button class="button button-dark header-login" data-action="login">Войти</button>';
  return `<header class="topbar">
    <button class="wordmark" data-action="navigate" data-page="home" aria-label="VEXA — на главную"><span class="wordmark-mark">V</span><span>VEXA</span></button>
    <div class="topbar-right">
      ${balance}
      <button class="icon-button theme-toggle" data-action="theme" aria-label="Переключить тему" title="Тема оформления">${state.theme === 'dark' ? '☼' : '☾'}</button>
      <button class="icon-button notification-button" data-action="navigate" data-page="notifications" aria-label="Уведомления">♧${state.notifications.some((n) => !n.read_at) ? '<i></i>' : ''}</button>
      ${account}
    </div>
  </header>`;
}

function sidebarHTML() {
  const primary = [
    { id: 'home', label: 'Обзор', icon: '⌂' },
    { id: 'collections', label: 'Коллекции', icon: '▧' },
    { id: 'market', label: 'Маркет', icon: '◈' }
  ];
  const personal = [
    { id: 'favorites', label: 'Избранное', icon: '♡', auth: true },
    { id: 'portfolio', label: 'Мой портфель', icon: '▦', auth: true },
    { id: 'orders', label: 'Мои ордера', icon: '⇄', auth: true },
    { id: 'trades', label: 'История сделок', icon: '↗' },
    { id: 'notifications', label: 'Уведомления', icon: '♧', auth: true }
  ];
  return `<aside class="sidebar">
    <div class="side-section-label">НАВИГАЦИЯ</div>
    ${primary.map(navButton).join('')}
    <div class="side-section-label side-section-spaced">МОЯ ПЛОЩАДКА</div>
    ${personal.filter((item) => !item.auth || state.user).map(navButton).join('')}
    <div class="sidebar-spacer"></div>
    <div class="side-section-label">АККАУНТ</div>
    ${state.user ? navButton({ id: 'profile', label: 'Профиль', icon: '◉' }) : '<button class="nav-link" data-action="login"><span class="nav-icon">◉</span><span>Войти / создать</span></button>'}
    ${state.admin ? navButton({ id: 'admin', label: 'Администрирование', icon: '⌘' }) : ''}
    <div class="sidebar-foot"><span class="online-dot"></span> Внутренняя экономика VEXA</div>
  </aside>`;
}
function mobileNavHTML() {
  const items = [
    { id: 'home', label: 'Главная', icon: '⌂' },
    { id: 'market', label: 'Маркет', icon: '◈' },
    ...(state.user ? [{ id: 'portfolio', label: 'Портфель', icon: '▦' }] : []),
    ...(state.user ? [{ id: 'favorites', label: 'Избранное', icon: '♡' }] : [{ id: 'login', label: 'Войти', icon: '◉' }]),
    { id: 'menu', label: 'Ещё', icon: '☷' }
  ];
  const primaryPages = ['home', 'market', 'portfolio', 'favorites'];
  return `<nav class="mobile-nav" aria-label="Основная навигация">${items.map((item) => {
    const active = item.id === 'menu'
      ? (!primaryPages.includes(state.page) && state.page !== 'detail')
      : state.page === item.id;
    return `<button class="${active ? 'active' : ''}" data-action="${item.id === 'login' ? 'login' : 'navigate'}" data-page="${item.id}" aria-label="${item.label}"><span>${item.icon}</span><small>${item.label}</small></button>`;
  }).join('')}</nav>`;
}
function rarityTag(rarity) {
  return `<span class="rarity-tag rarity-${rarityClass(rarity)}">${esc(rarity || 'Без редкости')}</span>`;
}

function variantCard(asset) {
  const offers = state.listings.filter((listing) => relation(listing.market_collectibles)?.asset_id === asset.id);
  const floor = offers.length ? Math.min(...offers.map((offer) => Number(offer.price))) : null;
  const collection = relation(asset.market_collections)?.name || 'Коллекция';
  const giftType = relation(asset.market_gift_types)?.name || '';
  const image = safeUrl(asset.image_url);
  return `<article class="nft-card" data-action="asset" data-id="${asset.id}" tabindex="0" role="button">
    <div class="nft-art ${image ? 'has-image' : ''}">
      ${image ? `<img src="${esc(image)}" alt="" loading="lazy">` : '<div class="art-placeholder"><span>V</span><i></i></div>'}
      <span class="edition-badge">${esc(collection)}</span>
      ${state.favorites.has(asset.id) ? '<span class="favorite-indicator">♥</span>' : ''}
      ${rarityTag(asset.rarity)}
    </div>
    <div class="nft-meta"><div><span class="eyebrow">${esc(giftType || collection)}</span><h3>${esc(asset.name)}</h3></div><span class="supply-count">${Number(asset.max_supply).toLocaleString('ru-RU')} шт.</span></div>
    <div class="nft-card-bottom"><div><span class="muted-caption">${floor === null ? 'Предложений нет' : 'Минимальное предложение'}</span><strong>${floor === null ? '—' : `${formatPrice(floor, state.currency, rateValue())} ${moneyLabel()}`}</strong></div><span class="card-arrow">↗</span></div>
  </article>`;
}

function listingCard(listing, compact = false) {
  const collectible = relation(listing.market_collectibles) || {};
  const asset = relation(collectible.market_assets) || {};
  const own = state.user && listing.user_id === state.user.id;
  return `<div class="listing-row ${compact ? 'compact' : ''}">
    <div class="listing-number">#${esc(collectible.serial_number ?? '—')}</div>
    <div class="listing-main"><strong>${esc(asset.name || 'NFT')}</strong><span>${esc(asset.rarity || 'Без редкости')} · ${own ? 'Ваше предложение' : 'На продаже'}</span></div>
    <div class="listing-price"><strong>${formatPrice(listing.price, state.currency, rateValue())} ${moneyLabel()}</strong><span>${formatRelative(listing.created_at)}</span></div>
    ${own ? '<span class="status-chip">Ваше</span>' : `<button class="button button-small button-dark" data-action="buy" data-collectible="${collectible.id}" data-price="${listing.price}">Купить</button>`}
  </div>`;
}

function emptyState(title, text, action = '') {
  return `<div class="empty-state"><div class="empty-mark">V</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;
}

function sectionHeader(title, subtitle = '', action = '') {
  return `<div class="section-header"><div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div>${action}</div>`;
}

function homePage() {
  const signedIn = Boolean(state.user);
  const shortcuts = [
    { id: 'collections', icon: '▧', title: 'Коллекции', desc: 'Смотри все опубликованные серии' },
    { id: 'market', icon: '◈', title: 'Маркет', desc: 'Ищи подарки и предложения' },
    ...(signedIn ? [
      { id: 'portfolio', icon: '▦', title: 'Мой портфель', desc: 'Твои цифровые экземпляры' },
      { id: 'orders', icon: '⇄', title: 'Мои ордера', desc: 'Заявки и их статусы' }
    ] : [
      { id: 'login', icon: '◉', title: 'Мой аккаунт', desc: 'Войти или создать аккаунт' }
    ])
  ];
  return `<section class="hero-panel home-hero">
      <div class="hero-copy"><span class="eyebrow hero-eyebrow"><i></i> ЦИФРОВАЯ ПЛОЩАДКА VEXA</span>
        <h1>Твоя коллекция.<br><em>Твой рынок.</em></h1>
        <p>Покупай, собирай и отслеживай цифровые подарки в едином пространстве.</p>
        <div class="hero-actions"><button class="button button-primary" data-action="navigate" data-page="market">Открыть маркет <span>↗</span></button><span class="hero-note">Тестовая внутренняя экономика · реальные платежи отключены</span></div>
      </div>
      <div class="hero-object" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="hero-gem"><span>V</span></div><div class="hero-glow"></div><div class="hero-coordinate">VEXA / 001</div></div>
    </section>
    <section class="metric-strip">
      <div><span>Коллекции</span><strong>${state.publicStats.collections.toLocaleString('ru-RU')}</strong></div>
      <div><span>Варианты NFT</span><strong>${state.publicStats.variants.toLocaleString('ru-RU')}</strong></div>
      <div><span>Завершённые сделки</span><strong>${state.publicStats.trades.toLocaleString('ru-RU')}</strong></div>
      <div><span>Реальные платежи</span><strong>Отключены</strong></div>
    </section>
    <section class="content-section home-shortcuts">
      ${sectionHeader('Быстрый доступ', 'Каждая функция находится в своём отдельном разделе')}
      <div class="hub-grid">${shortcuts.map((item) => `<button class="hub-card" data-action="${item.id === 'login' ? 'login' : 'navigate'}" data-page="${item.id}">
        <span class="hub-card-icon">${item.icon}</span><strong>${item.title}</strong><small>${item.desc}</small><span class="hub-card-arrow">↗</span>
      </button>`).join('')}</div>
    </section>
    <section class="content-section home-note">
      <div class="panel-card"><span class="eyebrow">ВАЖНО</span><h3>Внутренняя экономика</h3><p>Баланс VEXA — тестовые единицы внутри площадки. Их нельзя пополнять реальными деньгами или выводить. Стартовый баланс нового аккаунта — 0.</p></div>
    </section>`;
}
function marketPage() {
  const rarities = [...new Set(state.variants.map((asset) => asset.rarity).filter(Boolean))].sort();
  const variants = [...state.variants];
  if (state.catalogSort === 'price') variants.sort((a, b) => minPrice(a.id) - minPrice(b.id));
  if (state.catalogSort === 'newest') variants.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return `<section class="page-heading"><div><span class="eyebrow">VEXA / MARKETPLACE</span><h1>Маркет</h1><p>Коллекционные цифровые предметы и активные предложения.</p></div><div class="heading-stat"><strong>${variants.length}</strong><span>вариантов в выборке</span></div></section>
    <section class="filter-panel">
      <form id="market-search-form" class="search-field"><span>⌕</span><input id="market-search" name="search" value="${esc(state.catalogSearch)}" placeholder="Поиск подарков и редкостей"><button type="submit" aria-label="Искать">↵</button></form>
      <select id="collection-filter"><option value="">Все коллекции</option>${state.collections.map((item) => `<option value="${item.id}" ${state.collectionFilter === item.id ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select>
      <select id="rarity-filter"><option value="">Все редкости</option>${rarities.map((item) => `<option value="${esc(item)}" ${state.rarityFilter === item ? 'selected' : ''}>${esc(item)}</option>`).join('')}</select>
      <select id="sort-filter"><option value="newest" ${state.catalogSort === 'newest' ? 'selected' : ''}>Сначала новые</option><option value="price" ${state.catalogSort === 'price' ? 'selected' : ''}>По минимальной цене</option></select>
      <button class="button button-outline" data-action="clear-filters">Сбросить</button>
    </section>
    <section class="market-results">
      <div class="results-line"><span>${variants.length} вариантов</span><span>Цены указаны во внутренних единицах VEXA</span></div>
      ${variants.length ? `<div class="nft-grid">${variants.map(variantCard).join('')}</div>${state.catalogHasMore ? '<div class="load-more-wrap"><button class="button button-outline" data-action="load-more">Показать ещё</button></div>' : ''}` : emptyState('Ничего не найдено', 'Измени параметры поиска или вернись к полному каталогу.')}
    </section>`;
}

function minPrice(assetId) {
  const offers = state.listings.filter((listing) => relation(listing.market_collectibles)?.asset_id === assetId);
  return offers.length ? Math.min(...offers.map((offer) => Number(offer.price))) : Number.MAX_SAFE_INTEGER;
}

function tradeRow(trade) {
  const collectible = relation(trade.market_collectibles) || {};
  const asset = relation(collectible.market_assets) || {};
  return `<div class="activity-row"><div class="activity-symbol">◈</div><div class="activity-details"><strong>${esc(asset.name || 'NFT')} <span>${esc(asset.rarity || '')}</span></strong><small>Экземпляр #${esc(collectible.serial_number ?? '—')} · ${formatRelative(trade.created_at)}</small></div><div class="activity-price"><strong>${formatPrice(trade.price, state.currency, rateValue())} ${moneyLabel()}</strong><small>Сделка завершена</small></div></div>`;
}

function detailPage() {
  const asset = state.selectedAsset;
  if (!asset) return emptyState('NFT не выбран', 'Выбери предмет в каталоге.');
  const giftType = relation(asset.market_gift_types)?.name || '';
  const collection = relation(asset.market_collections)?.name || '';
  const siblings = asset.gift_type_id ? state.variants.filter((item) => item.gift_type_id === asset.gift_type_id && item.id !== asset.id) : [];
  const modelUrl = safeUrl(asset.model_url);
  const imageUrl = safeUrl(asset.image_url);
  return `<div class="detail-back"><button class="text-action" data-action="back-market">← Вернуться в маркет</button><span>VEXA / ITEM / ${esc(asset.id.slice(0, 8).toUpperCase())}</span></div>
    <section class="detail-layout">
      <div class="detail-visual">
        <div class="detail-art-top"><span>3D COLLECTIBLE</span><span>${rarityTag(asset.rarity)}</span></div>
        <div class="detail-viewer" id="detail-viewer">
          ${modelUrl ? '<div class="viewer-loading">Загружаем 3D-модель…</div>' : imageUrl ? `<img src="${esc(imageUrl)}" alt="${esc(asset.name)}">` : '<div class="viewer-fallback">Для этого варианта 3D-модель пока не загружена</div>'}
        </div>
        <div class="viewer-caption"><span>Перетаскивай, чтобы вращать</span><span>SCROLL / PINCH — ZOOM</span></div>
      </div>
      <div class="detail-info">
        <span class="eyebrow">${esc(collection || 'VEXA COLLECTION')}</span>
        <h1>${esc(asset.name)}</h1>
        <p class="detail-subtitle">${esc(giftType ? giftType + ' · ' : '')}${esc(asset.rarity || 'Без редкости')}</p>
        <p class="detail-description">${esc(asset.description || 'Описание для этого варианта ещё не добавлено.')}</p>
        <div class="detail-facts"><div><span>Коллекция</span><strong>${esc(collection || '—')}</strong></div><div><span>Тираж</span><strong>${Number(asset.max_supply).toLocaleString('ru-RU')}</strong></div><div><span>Начальная цена</span><strong>${formatPrice(asset.initial_price, state.currency, rateValue())} ${moneyLabel()}</strong></div></div>
        <div class="detail-action-panel"><div><span>Активных предложений</span><strong>${state.detailListings.length}</strong></div><span class="muted-caption">Цена формируется только реальными предложениями и сделками</span><button class="button button-outline full-width" data-action="favorite" data-id="${asset.id}">${state.favorites.has(asset.id) ? '♥ В избранном' : '♡ Добавить в избранное'}</button></div>
      </div>
    </section>
    <section class="content-section chart-section">
      <div class="section-header"><div><h2>История цены</h2><p>OHLC по исполненным сделкам · пустые интервалы не дорисовываются</p></div><div class="chart-timeframes">${['1m','5m','15m','1h','4h','1d'].map((frame)=>`<button class="${state.detailTimeframe===frame?'active':''}" data-action="timeframe" data-timeframe="${frame}">${frame}</button>`).join('')}</div></div>
      ${state.detailCandles.length ? `<div class="chart-panel"><div class="chart-metrics"><span>Последнее закрытие <strong>${formatPrice(state.detailCandles.at(-1).close_price,state.currency,rateValue())} ${moneyLabel()}</strong></span><span>Свечей <strong>${state.detailCandles.length}</strong></span><span>Сделок в последней свече <strong>${Number(state.detailCandles.at(-1).trade_count||0)}</strong></span></div><canvas id="detail-candles" class="candles-canvas" aria-label="График OHLC по завершённым сделкам"></canvas></div>` : emptyState('Истории цены пока нет', 'На выбранном таймфрейме нет завершённых сделок. График появится после реальной торговой активности.')}
    </section>
    <section class="content-section detail-market">
      ${sectionHeader('Предложения на покупку', 'Доступные sell-ордера по этому варианту')}
      ${state.detailListings.length ? `<div class="listing-list">${state.detailListings.map((item) => listingCard(item)).join('')}</div>` : emptyState('Активных предложений нет', 'Ни один владелец не выставил этот вариант на продажу.')}
    </section>
    ${siblings.length ? `<section class="content-section">${sectionHeader('Другие редкости этого подарка', 'Связанные варианты одного базового подарка')}<div class="nft-grid">${siblings.map(variantCard).join('')}</div></section>` : ''}
    <section class="content-section">${sectionHeader('История сделок', 'Фактические завершённые операции по этому варианту')}${state.detailTrades.length ? `<div class="activity-table">${state.detailTrades.map(tradeRow).join('')}</div>` : emptyState('Истории пока нет', 'Завершённые сделки появятся здесь после первых торгов.')}</section>`;
}

function portfolioPage() {
  if (!state.user) return authRequiredPage();
  const listings = new Set(state.myOrders.filter((order) => order.side === 'sell' && order.status === 'open').map((order) => order.collectible_id));
  const owned = state.portfolio;
  const totalEstimate = owned.reduce((sum, item) => sum + Number(relation(item.market_assets)?.initial_price || 0), 0);
  return `<section class="page-heading"><div><span class="eyebrow">VEXA / YOUR COLLECTION</span><h1>Портфель</h1><p>Только предметы, которыми ты владеешь внутри VEXA.</p></div><div class="heading-stat"><strong>${owned.length}</strong><span>NFT в портфеле</span></div></section>
    <section class="portfolio-summary"><div><span>Коллекционные предметы</span><strong>${owned.length}</strong></div><div><span>Коллекции</span><strong>${new Set(owned.map((item) => relation(item.market_assets)?.collection_id).filter(Boolean)).size}</strong></div><div><span>Справочная сумма начальных цен</span><strong>${formatPrice(totalEstimate, state.currency, rateValue())} ${moneyLabel()}</strong><small>Не является рыночной оценкой</small></div></section>
    <section class="content-section"><div class="section-header"><div><h2>Мои NFT</h2><p>Выставленные экземпляры заблокированы от повторной продажи.</p></div></div>
      ${owned.length ? `<div class="portfolio-grid">${owned.map((item) => {
        const asset = relation(item.market_assets) || {};
        return `<article class="portfolio-card"><button class="portfolio-card-open" data-action="asset" data-id="${asset.id}"><div class="portfolio-art">${safeUrl(asset.image_url) ? `<img src="${esc(safeUrl(asset.image_url))}" alt="" loading="lazy">` : '<span>V</span>'}</div><div class="portfolio-card-info"><strong>${esc(asset.name)}</strong><span>${esc(asset.rarity || '')} · #${item.serial_number}</span></div></button><div class="portfolio-card-footer">${listings.has(item.id) ? '<span class="status-chip">На продаже</span>' : `<button class="button button-small button-outline" data-action="sell-item" data-id="${item.id}">Выставить на продажу</button>`}</div></article>`;
      }).join('')}</div>` : emptyState('Портфель пока пуст', 'Купленные или полученные экземпляры будут отображаться здесь.', '<button class="button button-primary" data-action="navigate" data-page="market">Перейти в маркет</button>')}
    </section>`;
}

function favoritesPage() {
  if (!state.user) return authRequiredPage();
  const items = state.favoriteVariants || [];
  return `<section class="page-heading"><div><span class="eyebrow">VEXA / SAVED ITEMS</span><h1>Избранное</h1><p>Коллекционные варианты, которые ты сохранил.</p></div><div class="heading-stat"><strong>${items.length}</strong><span>сохранено</span></div></section>
    <section class="content-section">${items.length ? `<div class="nft-grid">${items.map(variantCard).join('')}</div>` : emptyState('Избранное пусто', 'Открой страницу NFT и нажми «Добавить в избранное».', '<button class="button button-primary" data-action="navigate" data-page="market">Открыть маркет</button>')}</section>`;
}

function activityPage() {
  if (!state.user) return authRequiredPage();
  return `<section class="page-heading"><div><span class="eyebrow">VEXA / ORDER HISTORY</span><h1>История и ордера</h1><p>Твои открытые заявки и завершённые действия.</p></div></section>
    <section class="content-section">${sectionHeader('Мои ордера', 'Покупки резервируют баланс; отмена открытой заявки освобождает резерв.')}
      ${state.myOrders.length ? `<div class="orders-table">${state.myOrders.map((order) => `<div class="order-row"><div><span class="order-side ${order.side}">${order.side === 'buy' ? 'BUY' : 'SELL'}</span><strong>${formatPrice(order.price, state.currency, rateValue())} ${moneyLabel()}</strong></div><div><strong>${esc(order.status.toUpperCase())}</strong><small>${formatRelative(order.created_at)}</small></div><div>${order.reserved_amount ? `<span class="muted-caption">Резерв: ${formatPrice(order.reserved_amount, state.currency, rateValue())}</span>` : ''}</div>${order.status === 'open' ? `<button class="button button-small button-outline" data-action="cancel-order" data-id="${order.id}">Отменить</button>` : '<span class="muted-caption">—</span>'}</div>`).join('')}</div>` : emptyState('Заявок пока нет', 'После выставления NFT или размещения заявки на покупку она появится здесь.')}
    </section>
    <section class="content-section">${sectionHeader('Последние сделки на площадке', 'Публичная история исполненных ордеров')}
      ${state.trades.length ? `<div class="activity-table">${state.trades.map(tradeRow).join('')}</div>` : emptyState('Сделок пока нет', 'VEXA не генерирует фиктивную историю торгов.')}
    </section>`;
}

function profilePage() {
  if (!state.user) return authRequiredPage();
  const profile = state.profile || {};
  return `<section class="page-heading"><div><span class="eyebrow">VEXA / ACCOUNT</span><h1>Профиль</h1><p>Управление аккаунтом и публичной информацией.</p></div></section>
    <section class="profile-layout"><div class="profile-card"><div class="profile-avatar">${esc(initials(profile.display_name || profile.handle))}</div><div><h2>${esc(profile.display_name || 'Участник')}</h2><p>@${esc(profile.handle || '')}</p><small>ID: ${esc(state.user.id)}</small></div><div class="profile-separator"></div><div class="profile-stat"><span>Дата регистрации</span><strong>${formatDate(state.user.created_at)}</strong></div><div class="profile-stat"><span>Баланс</span><strong>${formatBalance(getBalance(), state.currency, rateValue())} ${moneyLabel()}</strong></div><div class="profile-stat"><span>Экземпляры NFT</span><strong>${state.portfolio.length}</strong></div><button class="button button-outline full-width" data-action="logout">Выйти из аккаунта</button></div>
      <div class="profile-settings"><div class="panel-card"><h3>Публичный профиль</h3><form id="profile-form" class="form-stack"><label>Отображаемое имя<input name="display_name" maxlength="60" value="${esc(profile.display_name || '')}" required></label><label>О себе<textarea name="bio" maxlength="300" rows="3">${esc(profile.bio || '')}</textarea></label><button class="button button-dark" type="submit">Сохранить профиль</button></form></div><div class="panel-card"><h3>Безопасность</h3><p>Для смены пароля используйте ссылку восстановления, отправленную на подтверждённую почту.</p><button class="button button-outline" data-action="reset-password">Отправить ссылку смены пароля</button></div><div class="panel-card"><h3>Экономика VEXA</h3><p>Баланс и NFT существуют только во внутренней тестовой системе. Пополнение и вывод реальных средств недоступны.</p></div></div>
    </section>`;
}

function notificationsPage() {
  if (!state.user) return authRequiredPage();
  return `<section class="page-heading"><div><span class="eyebrow">VEXA / INBOX</span><h1>Уведомления</h1><p>События аккаунта и торговой активности.</p></div></section>
    <section class="content-section"><div class="notification-list">
      ${state.notifications.length ? state.notifications.map((item) => `<article class="notification-row ${item.read_at ? '' : 'unread'}"><span class="notification-dot"></span><div><strong>${esc(item.title)}</strong><p>${esc(item.body || '')}</p><small>${formatRelative(item.created_at)}</small></div>${item.read_at ? '' : `<button class="text-action" data-action="notification-read" data-id="${item.id}">Отметить прочитанным</button>`}</article>`).join('') : emptyState('Уведомлений нет', 'Здесь появятся сообщения о покупках, продажах и событиях системы.')}
    </div></section>`;
}

function authRequiredPage() {
  return `<section class="auth-required">${emptyState('Нужен аккаунт VEXA', 'Войди или зарегистрируйся, чтобы увидеть баланс и портфель.', '<button class="button button-primary" data-action="login">Войти / создать аккаунт</button>')}</section>`;
}

function adminPage() {
  if (!state.admin) return emptyState('Нет доступа', 'Административные права проверяются сервером.');
  const stats = state.adminOverview || {};
  return `<section class="page-heading"><div><span class="eyebrow">VEXA / CONTROL ROOM</span><h1>Администрирование</h1><p>Управление коллекциями, выпусками и внутренней экономикой.</p></div><span class="admin-label">ADMIN ACCESS</span></section>
    <section class="admin-stats">
      ${[['Пользователи','users'],['Коллекции','collections'],['Базовые подарки','gift_types'],['Варианты редкости','variants'],['Выпущено экземпляров','collectibles'],['Сделки','trades'],['Открытые ордера','open_orders']].map(([label,key])=>`<div><span>${label}</span><strong>${Number(stats[key] || 0).toLocaleString('ru-RU')}</strong></div>`).join('')}
    </section>
    <section class="admin-grid">
      <div class="panel-card"><span class="eyebrow">01 / COLLECTION</span><h2>Создать коллекцию</h2><form id="admin-collection-form" class="form-stack"><label>Название<input name="name" required maxlength="80"></label><label>Slug<input name="slug" required maxlength="80" placeholder="my-collection"></label><label>Описание<textarea name="description" rows="2"></textarea></label><label>URL обложки<input name="cover_url" type="url" placeholder="https://..."></label><label>Статус<select name="status"><option value="draft">Черновик</option><option value="published">Опубликована</option></select></label><button class="button button-dark" type="submit">Создать коллекцию</button></form></div>
      <div class="panel-card"><span class="eyebrow">02 / BASE GIFT</span><h2>Базовый подарок</h2><form id="admin-gift-form" class="form-stack"><label>Коллекция<select name="collection_id" required><option value="">Выбери коллекцию</option>${state.adminCollections.map((c)=>`<option value="${c.id}">${esc(c.name)} · ${esc(c.status)}</option>`).join('')}</select></label><label>Название<input name="name" required maxlength="80"></label><label>Slug<input name="slug" required maxlength="80"></label><label>Описание<textarea name="description" rows="2"></textarea></label><label>URL обложки<input name="cover_url" type="url"></label><label>Статус<select name="status"><option value="draft">Черновик</option><option value="published">Опубликован</option></select></label><button class="button button-dark" type="submit">Создать подарок</button></form></div>
      <div class="panel-card"><span class="eyebrow">03 / RARITY VARIANT</span><h2>Создать редкость и выпуск</h2><form id="admin-variant-form" class="form-stack"><label>Базовый подарок<select name="gift_type_id" required><option value="">Выбери подарок</option>${state.adminGiftTypes?.map((g)=>`<option value="${g.id}">${esc(g.name)}</option>`).join('') || ''}</select></label><label>Название варианта<input name="name" required maxlength="120"></label><label>Редкость<input name="rarity" required maxlength="40" placeholder="Mythic / Легендарная"></label><label>Описание<textarea name="description" rows="2"></textarea></label><div class="form-two"><label>Начальная цена<input name="initial_price" type="number" min="0" step="1" value="0" required></label><label>Тираж<input name="max_supply" type="number" min="1" step="1" required></label></div><div class="form-two"><label>Выпустить сейчас<input name="mint_quantity" type="number" min="0" step="1" value="0" required></label><label>Статус<select name="status"><option value="draft">Черновик</option><option value="published">Опубликован</option></select></label></div><label>Изображение preview URL<input name="image_url" type="url"></label><label>3D-модель GLB<input name="model" type="file" accept=".glb,model/gltf-binary"><small>Максимум 25 МБ. Модель загрузится в Storage с администраторскими правами.</small></label><p class="form-hint">Новые экземпляры поступят в твой административный инвентарь. Каждый можно отдельно выставить на продажу.</p><button class="button button-dark" type="submit">Создать вариант и выпустить</button></form></div>
      <div class="panel-card"><span class="eyebrow">04 / VIRTUAL WALLET</span><h2>Начислить внутренний баланс</h2><form id="admin-users-form" class="form-stack"><label>Найти пользователя по email, handle или UUID<input name="search" required placeholder="Поиск пользователя"></label><button class="button button-outline" type="submit">Найти</button></form><div class="admin-user-results">${state.adminUsers.map((u)=>`<button class="admin-user-result" data-action="select-admin-user" data-id="${u.id}"><span><strong>${esc(u.display_name || u.handle || u.email || u.id)}</strong><small>${esc(u.email || u.handle || u.id)}</small></span><b>${formatPrice(u.balance || 0, 'RUB', null)} ₽</b></button>`).join('')}</div>${state.selectedAdminUser ? `<form id="admin-balance-form" class="form-stack"><input type="hidden" name="user_id" value="${state.selectedAdminUser.id}"><p class="selected-user">Выбран: ${esc(state.selectedAdminUser.email || state.selectedAdminUser.handle || state.selectedAdminUser.id)}</p><label>Сумма начисления<input name="amount" type="number" min="1" max="1000000000" step="1" required></label><label>Причина<textarea name="reason" minlength="3" maxlength="500" required></textarea></label><button class="button button-dark" type="submit">Начислить VEX</button></form>` : ''}</div>
      <div class="panel-card"><span class="eyebrow">05 / MARKET CONTROL</span><h2>Состояние рынка</h2><p>Включение и пауза торгов. Комиссия остаётся 0 до внедрения её расчёта непосредственно в атомарную торговую транзакцию.</p><div class="settings-switch"><span>Торговля включена</span><button class="switch ${state.adminSettings?.trading_enabled ? 'on' : ''}" data-action="toggle-trading" aria-pressed="${Boolean(state.adminSettings?.trading_enabled)}"></button></div><button class="button button-outline full-width" data-action="refresh-admin">Обновить показатели</button></div>
    </section>
    <p class="admin-disclaimer">Начисления меняют только внутренние единицы VEXA. Реальные платежи, вывод средств и блокчейн-интеграции не подключены.</p>`;
}

function modalHTML() {
  if (!state.modal) return '';
  if (state.modal.type === 'auth') {
    const mode = state.modal.mode || 'login';
    const register = mode === 'register';
    const forgot = mode === 'forgot';
    return `<div class="modal-backdrop" data-action="close-modal"><section class="modal-card auth-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onclick="event.stopPropagation()">
      <button class="modal-close" data-action="close-modal" aria-label="Закрыть">×</button><span class="eyebrow">WELCOME TO VEXA</span><h2 id="modal-title">${register ? 'Создать аккаунт' : forgot ? 'Восстановить пароль' : 'С возвращением'}</h2><p>${register ? 'Твой профиль и пустой виртуальный кошелёк будут созданы после регистрации.' : forgot ? 'Отправим ссылку для восстановления доступа на почту.' : 'Войди, чтобы управлять коллекцией и балансом.'}</p>
      ${forgot ? `<form id="forgot-form" class="form-stack"><label>Email<input name="email" type="email" autocomplete="email" required></label><button class="button button-primary full-width" type="submit">Отправить ссылку</button></form>` : `<form id="auth-form" class="form-stack">
        ${register ? '<label>Имя пользователя<input name="username" minlength="3" maxlength="24" pattern="[A-Za-z0-9_]{3,24}" autocomplete="username" required><small>3–24 символа: латиница, цифры и _</small></label><label>Отображаемое имя<input name="display_name" maxlength="60" autocomplete="nickname" placeholder="Как тебя показывать"></label>' : ''}
        <label>Электронная почта<input name="email" type="email" autocomplete="email" required></label>
        <label>Пароль<input name="password" type="password" minlength="8" autocomplete="${register ? 'new-password' : 'current-password'}" required></label>
        ${register ? '<label>Повтори пароль<input name="password_repeat" type="password" minlength="8" autocomplete="new-password" required></label><label class="checkbox-label"><input name="agreement" type="checkbox" required><span>Принимаю правила VEXA и политику конфиденциальности.</span></label>' : ''}
        <button class="button button-primary full-width" type="submit">${register ? 'Зарегистрироваться' : 'Войти'}</button></form>`}
      <div class="auth-switch">${register ? 'Уже есть аккаунт?' : 'Нет аккаунта?'} <button class="text-action" data-action="auth-mode" data-mode="${register ? 'login' : 'register'}">${register ? 'Войти' : 'Создать аккаунт'}</button></div>
      ${!register && !forgot ? '<button class="forgot-link" data-action="auth-mode" data-mode="forgot">Забыли пароль?</button>' : ''}
      <div class="auth-legal">VEXA использует внутренние виртуальные единицы. Они не являются реальными деньгами.</div>
    </section></div>`;
  }
  if (state.modal.type === 'sell') {
    return `<div class="modal-backdrop" data-action="close-modal"><section class="modal-card" role="dialog" aria-modal="true" onclick="event.stopPropagation()"><button class="modal-close" data-action="close-modal">×</button><span class="eyebrow">CREATE SELL ORDER</span><h2>Выставить NFT</h2><p>Цена указывается во внутренних единицах VEXA.</p><form id="sell-form" class="form-stack"><input type="hidden" name="collectible_id" value="${state.modal.collectibleId}"><label>Цена предложения<input name="price" type="number" min="1" step="1" required></label><button class="button button-primary full-width" type="submit">Выставить на продажу</button></form></section></div>`;
  }
  return '';
}

function render() {
  disposeViewer();
  const currentPage = state.page;
  let pageContent = '';
  if (currentPage === 'home') pageContent = homePage();
  else if (currentPage === 'market') pageContent = marketPage();
  else if (currentPage === 'detail') pageContent = detailPage();
  else if (currentPage === 'portfolio') pageContent = portfolioPage();
  else if (currentPage === 'favorites') pageContent = favoritesPage();
  else if (currentPage === 'activity') pageContent = activityPage();
  else if (currentPage === 'profile') pageContent = profilePage();
  else if (currentPage === 'notifications') pageContent = notificationsPage();
  else if (currentPage === 'admin') pageContent = adminPage();
  else pageContent = homePage();

  document.documentElement.dataset.theme = state.theme;
  document.documentElement.style.colorScheme = state.theme;
  app.innerHTML = `${headerHTML()}<div class="app-layout">${sidebarHTML()}<main class="main-content"><div class="page-container">${pageContent}<footer class="site-footer"><span>© 2026 VEXA</span><span>Digital Collectibles Marketplace</span><span>Internal demo economy · no real-money operations</span></footer></div></main></div>${mobileNavHTML()}<div id="modal-root">${modalHTML()}</div><div id="toast" role="status" aria-live="polite"></div>`;
  if (currentPage === 'detail' && state.selectedAsset && safeUrl(state.selectedAsset.model_url)) {
    const container = document.querySelector('#detail-viewer');
    state.viewerDispose = mountGiftViewer(container, safeUrl(state.selectedAsset.model_url));
  }
  if (currentPage === 'detail') drawCandles(document.querySelector('#detail-candles'), state.detailCandles);
}

async function loadPublicData() {
  const [collections, variants, listings, trades, stats] = await Promise.all([
    getCollections(), getVariants({ search: state.catalogSearch, collectionId: state.collectionFilter, rarity: state.rarityFilter }),
    getListings(), getTrades({ limit: 30 }), getPublicStats()
  ]);
  state.collections = collections || [];
  state.variants = variants || [];
  state.listings = listings || [];
  state.trades = trades || [];
  state.publicStats = stats;
}

async function loadAccount() {
  if (!state.user) {
    state.profile = null; state.wallet = null; state.portfolio = []; state.myOrders = [];
    state.favoriteVariants = []; state.favorites = new Set(); state.notifications = []; state.admin = false;
    state.rate = null;
    return;
  }
  const [profile, wallet, portfolio, orders, favorites, notifications, rate, admin] = await Promise.all([
    getProfile(state.user.id), getWallet(state.user.id), getPortfolio(state.user.id),
    getMyOrders(state.user.id), getFavorites(state.user.id), getNotifications(state.user.id),
    getExchangeRate().catch(() => null), checkAdmin().catch(() => false)
  ]);
  state.profile = profile; state.wallet = wallet; state.portfolio = portfolio || [];
  state.myOrders = orders || []; state.favorites = new Set((favorites || []).map((item) => item.asset_id));
  state.notifications = notifications || []; state.rate = rate; state.admin = admin;
  state.favoriteVariants = state.favorites.size ? await getFavoriteVariants(state.user.id) : [];
  if (!rateValue()) state.currency = 'RUB';
  if (state.admin) await loadAdminData();
}

async function loadAdminData() {
  if (!state.admin) return;
  const [overview, settings, catalog] = await Promise.all([
    getAdminOverview(), getAdminSettings(), getAdminCatalog()
  ]);
  state.adminOverview = overview;
  state.adminSettings = settings;
  state.adminCollections = catalog?.collections || [];
  state.adminGiftTypes = catalog?.gift_types || [];
}

async function reloadAccountAndRender() {
  try {
    await loadAccount();
    await loadPublicData();
    render();
  } catch (error) {
    toast(error.message, 'error');
  }
}

function navigate(page) {
  if (page === 'login') { openAuth('login'); return; }
  if (['portfolio', 'favorites', 'activity', 'profile', 'notifications'].includes(page) && !state.user) {
    openAuth('login'); return;
  }
  if (page === 'admin' && !state.admin) {
    toast('Доступ запрещён: сервер не подтвердил права администратора', 'error'); return;
  }
  state.page = page;
  state.modal = null;
  if (page === 'market') loadCatalog().catch((error) => toast(error.message, 'error'));
  else if (page === 'favorites') loadFavorites().catch((error) => toast(error.message, 'error'));
  else render();
}

async function loadCatalog({ append = false } = {}) {
  const offset = append ? state.variants.length : 0;
  if (append) state.catalogLoadingMore = true;
  try {
    const [variants, listings] = await Promise.all([
      getVariants({ search: state.catalogSearch, collectionId: state.collectionFilter, rarity: state.rarityFilter, offset }),
      getListings()
    ]);
    state.variants = append ? [...state.variants, ...(variants || [])] : (variants || []);
    state.listings = listings || [];
    state.catalogHasMore = (variants || []).length === 48;
    state.catalogLoadingMore = false;
    render();
  } catch (error) {
    state.catalogLoadingMore = false;
    throw error;
  }
}

async function loadFavorites() {
  if (!state.user) { state.favoriteVariants = []; return; }
  state.favoriteVariants = await getFavoriteVariants(state.user.id);
  render();
}

async function openAsset(assetId) {
  const asset = [...state.variants, ...(state.favoriteVariants || [])].find((item) => item.id === assetId);
  if (!asset) { toast('Предмет не найден или больше не опубликован', 'error'); return; }
  state.selectedAsset = asset;
  state.page = 'detail';
  const [listings, trades, candles] = await Promise.all([
    getListings({ assetId }).catch(() => []),
    getTrades({ assetId, limit: 30 }).catch(() => []),
    getCandles(assetId, state.detailTimeframe).catch(() => [])
  ]);
  state.detailListings = listings;
  state.detailTrades = trades;
  state.detailCandles = candles;
  render();
}

function openAuth(mode = 'login') {
  state.modal = { type: 'auth', mode };
  render();
}

async function refreshAll() {
  await loadPublicData();
  if (state.user) await loadAccount();
  render();
}

async function handleClick(event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  try {
    if (action === 'navigate') navigate(target.dataset.page);
    else if (action === 'login') openAuth('login');
    else if (action === 'close-modal') { state.modal = null; render(); }
    else if (action === 'auth-mode') openAuth(target.dataset.mode);
    else if (action === 'theme') { state.theme = state.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('vexa-theme', state.theme); render(); }
    else if (action === 'currency') {
      if (!rateValue()) { toast('Курс валют пока недоступен', 'error'); return; }
      state.currency = state.currency === 'RUB' ? 'USD' : 'RUB';
      render();
      toast(`Курс Банка России: ${Number(rateValue()).toFixed(4)} ₽ за $1 · ${formatDate(state.rate?.fetched_at)}${state.rate?.stale ? ' · последний сохранённый курс' : ''}`);
    } else if (action === 'asset') openAsset(target.dataset.id);
    else if (action === 'back-market') navigate('market');
    else if (action === 'timeframe' && state.selectedAsset) {
      state.detailTimeframe = target.dataset.timeframe;
      state.detailCandles = await getCandles(state.selectedAsset.id, state.detailTimeframe);
      render();
    }
    else if (action === 'collection') {
      state.collectionFilter = target.dataset.id; state.catalogSearch = ''; state.page = 'market';
      await loadCatalog();
    } else if (action === 'clear-filters') {
      state.catalogSearch = ''; state.collectionFilter = ''; state.rarityFilter = ''; state.catalogSort = 'newest';
      await loadCatalog();
    } else if (action === 'favorite') {
      if (!state.user) { openAuth('login'); return; }
      const id = target.dataset.id; const enabled = !state.favorites.has(id);
      await setFavorite(state.user.id, id, enabled);
      enabled ? state.favorites.add(id) : state.favorites.delete(id);
      state.favoriteVariants = await getFavoriteVariants(state.user.id);
      render();
    } else if (action === 'buy') await buyCollectible(target.dataset.collectible, Number(target.dataset.price));
    else if (action === 'sell-item') { state.modal = { type: 'sell', collectibleId: target.dataset.id }; render(); }
    else if (action === 'cancel-order') {
      if (!confirm('Отменить открытую заявку? Резерв по заявке на покупку будет освобождён.')) return;
      await cancelOrder(target.dataset.id); toast('Заявка отменена'); await refreshAll();
    } else if (action === 'logout') {
      await signOut(); toast('Вы вышли из аккаунта'); state.page = 'home'; state.modal = null; await refreshAll();
    } else if (action === 'reset-password') {
      await sendPasswordReset(state.user.email); toast('Письмо для восстановления отправлено');
    } else if (action === 'notification-read') {
      await markNotificationRead(target.dataset.id);
      state.notifications = await getNotifications(state.user.id); render();
    } else if (action === 'refresh-admin') {
      await loadAdminData(); render(); toast('Данные обновлены');
    } else if (action === 'toggle-trading') {
      const enabled = !state.adminSettings?.trading_enabled;
      await updateMarketSettings({ trading_enabled: enabled });
      await loadAdminData(); render(); toast(enabled ? 'Торговля включена' : 'Торговля приостановлена');
    } else if (action === 'select-admin-user') {
      state.selectedAdminUser = state.adminUsers.find((user) => user.id === target.dataset.id) || null;
      render();
    }
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function buyCollectible(collectibleId, price) {
  if (!state.user) { openAuth('login'); return; }
  if (!confirm(`Создать заявку на покупку за ${formatPrice(price, state.currency, rateValue())} ${moneyLabel()}? Если она исполнится, предмет перейдёт в твой портфель.`)) return;
  const result = await submitOrder({ collectibleId, side: 'buy', price });
  toast(result?.status === 'filled' ? 'Покупка завершена' : 'Заявка создана. Баланс зарезервирован до исполнения или отмены.');
  await refreshAll();
  if (state.selectedAsset) await openAsset(state.selectedAsset.id);
}

async function handleSubmit(event) {
  const form = event.target;
  const id = form.id;
  if (!id) return;
  event.preventDefault();
  const fd = new FormData(form);
  const button = form.querySelector('button[type="submit"]');
  if (button) { button.disabled = true; button.classList.add('loading'); }
  try {
    if (id === 'market-search-form') {
      state.catalogSearch = String(fd.get('search') || '').trim();
      await loadCatalog();
    } else if (id === 'auth-form') {
      const email = String(fd.get('email') || '');
      const password = String(fd.get('password') || '');
      if (state.modal?.mode === 'register') {
        const username = String(fd.get('username') || '').trim();
        const repeated = String(fd.get('password_repeat') || '');
        if (!isValidHandle(username)) throw new Error('Имя пользователя должно содержать 3–24 символа: латиницу, цифры или _');
        if (password.length < 8) throw new Error('Пароль должен содержать минимум 8 символов');
        if (password !== repeated) throw new Error('Пароли не совпадают');
        if (!fd.get('agreement')) throw new Error('Необходимо принять правила платформы');
        const result = await signUp({ email, password, username, displayName: String(fd.get('display_name') || username).trim() });
        state.modal = null;
        toast(result.session ? 'Аккаунт создан' : 'Проверь почту и подтверди адрес, чтобы войти');
        if (result.session) state.session = result.session;
        await refreshAll();
      } else {
        const result = await signIn(email, password);
        state.session = result.session; state.user = result.user; state.modal = null;
        toast('Вход выполнен');
        await refreshAll();
      }
    } else if (id === 'forgot-form') {
      await sendPasswordReset(String(fd.get('email') || ''));
      state.modal = null; render(); toast('Ссылка восстановления отправлена на почту');
    } else if (id === 'sell-form') {
      const collectibleId = String(fd.get('collectible_id'));
      const price = Number(fd.get('price'));
      if (!Number.isSafeInteger(price) || price <= 0) throw new Error('Укажи положительную целую цену');
      const result = await submitOrder({ collectibleId, side: 'sell', price });
      state.modal = null; toast(result?.status === 'filled' ? 'Заявка исполнена' : 'NFT выставлен на продажу');
      await refreshAll();
    } else if (id === 'profile-form') {
      const { error } = await supabase.from('market_profiles').update({
        display_name: String(fd.get('display_name') || '').trim(),
        bio: String(fd.get('bio') || '').trim()
      }).eq('id', state.user.id);
      if (error) throw error;
      await loadAccount(); render(); toast('Профиль сохранён');
    } else if (id === 'admin-collection-form') {
      const payload = Object.fromEntries(fd.entries());
      const result = await createCollection(payload);
      toast('Коллекция создана: ' + result.id); await loadAdminData(); await loadPublicData(); render();
    } else if (id === 'admin-gift-form') {
      const result = await createGiftType(Object.fromEntries(fd.entries()));
      toast('Базовый подарок создан: ' + result.id);
      await loadAdminData(); await loadPublicData(); render();
    } else if (id === 'admin-variant-form') {
      const modelFile = fd.get('model');
      let modelUrl = '';
      let modelSizeBytes = null;
      if (modelFile instanceof File && modelFile.size) {
        const uploaded = await uploadModel(modelFile, state.user.id);
        modelUrl = uploaded.publicUrl; modelSizeBytes = uploaded.size;
      }
      const payload = {
        gift_type_id: String(fd.get('gift_type_id')),
        name: String(fd.get('name')).trim(),
        rarity: String(fd.get('rarity')).trim(),
        description: String(fd.get('description') || ''),
        image_url: String(fd.get('image_url') || ''),
        model_url: modelUrl,
        model_size_bytes: modelSizeBytes,
        initial_price: Number(fd.get('initial_price')),
        max_supply: Number(fd.get('max_supply')),
        mint_quantity: Number(fd.get('mint_quantity')),
        status: String(fd.get('status'))
      };
      if (!Number.isSafeInteger(payload.max_supply) || payload.max_supply < 1 ||
          !Number.isSafeInteger(payload.mint_quantity) || payload.mint_quantity < 0 ||
          payload.mint_quantity > payload.max_supply ||
          !Number.isSafeInteger(payload.initial_price) || payload.initial_price < 0) {
        throw new Error('Проверь цену, тираж и количество выпуска');
      }
      const result = await createVariant(payload);
      toast(`Вариант создан. Выпущено экземпляров: ${result.minted}`);
      await loadAdminData(); await loadPublicData(); render();
    } else if (id === 'admin-users-form') {
      state.adminUsers = await listAdminUsers(String(fd.get('search') || '').trim());
      render();
    } else if (id === 'admin-balance-form') {
      const result = await adjustBalance({
        user_id: String(fd.get('user_id')),
        amount: Number(fd.get('amount')),
        reason: String(fd.get('reason') || '').trim()
      });
      toast('Баланс начислен. Текущее значение: ' + result.balance);
      state.selectedAdminUser = null; await loadAdminData(); render();
    }
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    if (button?.isConnected) { button.disabled = false; button.classList.remove('loading'); }
  }
}

function handleChange(event) {
  const target = event.target;
  if (target.id === 'collection-filter') {
    state.collectionFilter = target.value; loadCatalog().catch((error) => toast(error.message, 'error'));
  } else if (target.id === 'rarity-filter') {
    state.rarityFilter = target.value; loadCatalog().catch((error) => toast(error.message, 'error'));
  } else if (target.id === 'sort-filter') {
    state.catalogSort = target.value; render();
  } else if (target.id === 'market-search') {
    state.catalogSearch = target.value;
  }
}

let searchTimer;
function handleInput(event) {
  if (event.target.id === 'market-search') state.catalogSearch = event.target.value;
}

app.addEventListener('click', (event) => handleClick(event));
app.addEventListener('submit', (event) => handleSubmit(event));
app.addEventListener('change', handleChange);
app.addEventListener('input', handleInput);
app.addEventListener('keydown', (event) => {
  const card = event.target.closest('.nft-card');
  if (card && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault(); openAsset(card.dataset.id);
  }
});

async function initialize() {
  render();
  try {
    const session = await getSession();
    state.session = session;
    state.user = session?.user || null;
    await loadPublicData();
    await loadAccount();
    render();
  } catch (error) {
    toast(error.message, 'error');
  }
  subscribeToAuth(async (session) => {
    const previous = state.user?.id;
    state.session = session;
    state.user = session?.user || null;
    if (previous !== state.user?.id) {
      try { await loadAccount(); render(); } catch (error) { toast(error.message, 'error'); }
    }
  });
  const unsubscribe = subscribeToMarket(() => {
    clearTimeout(initialize.marketTimer);
    initialize.marketTimer = setTimeout(() => refreshAll().catch(() => {}), 650);
  });
  window.addEventListener('beforeunload', () => { disposeViewer(); unsubscribe(); }, { once: true });
}

initialize();
