(() => {
  "use strict";

  const config = window.APP_CONFIG || {};
  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  const screen = document.getElementById("screen");
  const titleEl = document.getElementById("page-title");
  const subtitleEl = document.getElementById("page-subtitle");
  const backButton = document.getElementById("back-button");
  const balancePill = document.getElementById("balance-pill");
  const balanceValue = document.getElementById("balance-value");
  const bottomNav = document.getElementById("bottom-nav");
  const toastEl = document.getElementById("toast");

  const state = {
    sb: null,
    user: null,
    profile: null,
    wallet: null,
    fxRate: null,
    displayCurrency: "RUB",
    preferences: { theme: "light", language: "ru", display_currency: "RUB", notifications_enabled: true, price_alerts_enabled: true },
    access: { can_access: true, can_trade: true, can_list: true, can_use_wallet: true, can_use_collectibles: true },
    isAdmin: false,
    tab: "market",
    view: "market",
    back: null,
    currentCollection: null,
    currentAsset: null,
    currentCollectible: null,
    assetReturnView: "market",
    assetReturnCollection: null,
    currentTimeframe: "1h",
    collectionFilter: { sort: "price_asc", model: "all", background: "all", pattern: "all" },
    collectionItems: [],
    inventory: [],
    adminSelectedUser: null,
    adminCollections: [],
    adminGiftTypes: [],
    adminVariants: []
  };

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char];
    });
  }
  function fmt(value) {
    return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Number(value || 0));
  }
  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toastEl.classList.remove("show"), 2600);
  }
  function loading(label) {
    screen.innerHTML = '<div class="loading-state"><div class="loader"></div><span>' + esc(label || "Загрузка…") + "</span></div>";
  }
  function empty(icon, title, text) {
    return '<div class="empty-state"><div class="empty-icon">' + (icon || "✧") + '</div><div class="empty-title">' +
      esc(title) + '</div><div class="empty-text">' + esc(text) + "</div></div>";
  }
  function setHeader(title, subtitle, canBack) {
    titleEl.textContent = title;
    subtitleEl.textContent = subtitle || "";
    backButton.hidden = !canBack;
  }
  function setBalance() {
    balancePill.hidden = !state.user;
    const rawBalance = Number(state.wallet && state.wallet.balance || 0);
    const symbol = document.getElementById("currency-symbol");
    if (state.displayCurrency === "USD" && state.fxRate && state.fxRate > 0) {
      if (symbol) symbol.textContent = "$";
      balanceValue.textContent = new Intl.NumberFormat("ru-RU", {
        minimumFractionDigits: 2, maximumFractionDigits: 2
      }).format(rawBalance / state.fxRate);
    } else {
      if (symbol) symbol.textContent = "₽";
      balanceValue.textContent = fmt(rawBalance);
    }
  }
  function setTabActive(tab) {
    bottomNav.querySelectorAll("[data-tab]").forEach((button) => {
      button.classList.toggle("active", button.dataset.tab === tab);
    });
  }
  function setTheme(theme) {
    const next = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    state.preferences.theme = next;
    if (tg) {
      try {
        tg.setHeaderColor(next === "dark" ? "#121319" : "#f5f4f8");
        tg.setBackgroundColor(next === "dark" ? "#121319" : "#f5f4f8");
      } catch (_) {}
    }
  }
  function mediaHtml(item, extraClass) {
    const cls = extraClass || "";
    if (item && item.model_url) {
      return '<div class="gift-visual ' + cls + '"><model-viewer src="' + esc(item.model_url) +
        '" camera-controls auto-rotate rotation-per-second="18deg" shadow-intensity="0.7" loading="lazy" ar></model-viewer></div>';
    }
    if (item && item.image_url) {
      const url = String(item.image_url);
      if (/\.(mp4|webm|mov)(?:[?#].*)?$/i.test(url)) {
        return '<div class="gift-visual ' + cls + '"><video src="' + esc(url) +
          '" autoplay muted loop playsinline preload="metadata"></video></div>';
      }
      return '<div class="gift-visual ' + cls + '"><img src="' + esc(url) +
        '" alt="' + esc(item.name || "Подарок") + '" loading="lazy"></div>';
    }
    if (item && item.cover_url) {
      return '<div class="gift-visual ' + cls + '"><img src="' + esc(item.cover_url) +
        '" alt="' + esc(item.name || "Коллекция") + '" loading="lazy"></div>';
    }
    return '<div class="gift-visual ' + cls + '"><div class="gift-placeholder">✧</div></div>';
  }
  function getErrorMessage(error) {
    if (!error) return "Неизвестная ошибка";
    if (error.message) return error.message;
    return String(error);
  }
  async function api(action, payload) {
    const response = await state.sb.functions.invoke("market-api", {
      body: Object.assign({ action: action }, payload || {})
    });
    if (response.error) {
      let message = response.error.message || "Ошибка сервера";
      try {
        if (response.error.context && typeof response.error.context.json === "function") {
          const body = await response.error.context.json();
          if (body && body.error) message = body.error;
        }
      } catch (_) {}
      throw new Error(message);
    }
    if (response.data && response.data.error) throw new Error(response.data.error);
    return response.data ? response.data.data : null;
  }
  async function refreshAccount() {
    const [profileResult, walletResult, prefsResult, accessResult] = await Promise.all([
      state.sb.from("market_profiles").select("id,handle,display_name,avatar_url,bio").eq("id", state.user.id).maybeSingle(),
      state.sb.from("market_wallets").select("user_id,balance,reserved_balance,currency_code").eq("user_id", state.user.id).maybeSingle(),
      state.sb.from("market_user_preferences").select("theme,language,display_currency,notifications_enabled,price_alerts_enabled").eq("user_id", state.user.id).maybeSingle(),
      api("get_access_status")
    ]);
    if (profileResult.error) throw profileResult.error;
    if (walletResult.error) throw walletResult.error;
    if (prefsResult.error) throw prefsResult.error;
    state.profile = profileResult.data || {};
    state.wallet = walletResult.data || { balance: 0, reserved_balance: 0 };
    if (prefsResult.data) state.preferences = prefsResult.data;
    else {
      const insert = await state.sb.from("market_user_preferences").upsert({
        user_id: state.user.id,
        theme: "light",
        language: "ru"
      });
      if (insert.error) throw insert.error;
      state.preferences = { theme: "light", language: "ru", display_currency: "RUB", notifications_enabled: true, price_alerts_enabled: true };
    }
    state.access = accessResult || state.access;
    state.displayCurrency = state.preferences.display_currency === "USD" ? "USD" : "RUB";
    try {
      const fx = await api("get_fx_rate");
      state.fxRate = Number(fx && fx.rub_per_usd) || null;
    } catch (error) {
      console.warn("FX rate unavailable; displaying RUB only", error);
    }
    setTheme(state.preferences.theme);
    setBalance();
    try {
      state.isAdmin = (await api("admin_check")) === true;
    } catch (_) {
      state.isAdmin = false;
    }
  }
  async function authenticate() {
    if (!config.SUPABASE_URL || !config.SUPABASE_PUBLISHABLE_KEY) {
      throw new Error("Не заполнены настройки подключения Supabase в config.js");
    }
    if (!tg || !tg.initData) {
      screen.innerHTML = empty("✈", "Откройте через Telegram", "Это приложение работает как Telegram Mini App. Откройте его кнопкой в вашем Telegram-боте.");
      setHeader("Gift Market", "Telegram Mini App", false);
      bottomNav.hidden = true;
      return false;
    }
    try {
      tg.ready();
      tg.expand();
      tg.setHeaderColor("#f5f4f8");
      tg.setBackgroundColor("#f5f4f8");
    } catch (_) {}

    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("Не удалось загрузить клиент Supabase");
    }
    state.sb = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });

    loading("Проверяем Telegram…");
    const authResult = await state.sb.functions.invoke("telegram-auth", {
      body: { init_data: tg.initData }
    });
    if (authResult.error) {
      let message = authResult.error.message || "Ошибка авторизации Telegram";
      try {
        if (authResult.error.context && typeof authResult.error.context.json === "function") {
          const body = await authResult.error.context.json();
          if (body && body.error) message = body.error;
        }
      } catch (_) {}
      throw new Error(message);
    }
    if (!authResult.data || !authResult.data.token_hash) {
      throw new Error("Telegram не вернул токен входа");
    }
    const verified = await state.sb.auth.verifyOtp({
      token_hash: authResult.data.token_hash,
      type: "magiclink"
    });
    if (verified.error) throw verified.error;
    state.user = verified.data.user;
    if (!state.user) throw new Error("Не удалось создать сессию пользователя");

    await refreshAccount();
    bottomNav.hidden = false;
    if (state.access && state.access.can_access === false) {
      setHeader("Доступ ограничен", "Свяжитесь с поддержкой", false);
      screen.innerHTML = empty("⛔", "Аккаунт заблокирован", "Вход выполнен, но доступ к площадке ограничен. Причина: " +
        ((state.access.restrictions || []).map((r) => r.reason).filter(Boolean).join("; ") || "не указана"));
      bottomNav.hidden = true;
      return true;
    }
    await setTab("market");
    return true;
  }

  async function setTab(tab) {
    state.tab = tab;
    state.view = tab;
    state.back = null;
    setTabActive(tab);
    if (tab === "market") return renderMarket();
    if (tab === "my_nft") return renderMyNft();
    if (tab === "settings") return renderSettings();
  }

  async function renderMarket() {
    setHeader("Рынок", "Коллекционные подарки", false);
    loading("Загружаем коллекции…");
    const result = await state.sb.from("market_collections")
      .select("id,slug,name,description,cover_url,status,created_at")
      .eq("status", "published")
      .order("created_at", { ascending: false });
    if (result.error) throw result.error;
    const collections = result.data || [];
    if (!collections.length) {
      screen.innerHTML = empty("✧", "Пока нет коллекций", "Когда администратор создаст и опубликует коллекции, они появятся здесь. Подарки не добавляются автоматически.");
      return;
    }
    const items = await Promise.all(collections.map(async (collection) => {
      const count = await state.sb.from("market_assets").select("id", { count: "exact", head: true })
        .eq("collection_id", collection.id).eq("status", "published");
      return Object.assign({}, collection, { assetCount: count.count || 0 });
    }));
    screen.innerHTML = '<div class="section-heading"><h2>Коллекции</h2><span class="section-note">' +
      items.length + " шт.</span></div><div class=\"collection-list\">" + items.map((item) =>
        '<button class="collection-card" type="button" data-action="open-collection" data-id="' + item.id + '">' +
          '<div class="collection-cover">' + (item.cover_url ? '<img src="' + esc(item.cover_url) + '" alt="">' : "✧") + '</div>' +
          '<div class="collection-info"><div class="collection-name">' + esc(item.name) + '</div>' +
          '<div class="collection-desc">' + esc(item.description || "Коллекция цифровых подарков") + '</div>' +
          '<div class="collection-count">' + item.assetCount + " моделей</div></div><span class=\"arrow\">›</span></button>"
      ).join("") + "</div>";
  }

  async function openCollection(id) {
    state.currentCollection = id;
    state.view = "collection";
    state.back = () => renderMarket();
    setHeader("Коллекция", "Предложения и экземпляры", true);
    loading("Загружаем подарки…");
    const collectionResult = await state.sb.from("market_collections")
      .select("id,name,description,cover_url").eq("id", id).maybeSingle();
    if (collectionResult.error) throw collectionResult.error;
    const collection = collectionResult.data;
    if (!collection) throw new Error("Коллекция не найдена");

    const assetsResult = await state.sb.from("market_assets")
      .select("id,name,description,image_url,model_url,rarity,initial_price,max_supply,collection_id,status,metadata,created_at")
      .eq("collection_id", id).eq("status", "published").order("created_at", { ascending: false });
    if (assetsResult.error) throw assetsResult.error;
    const assets = assetsResult.data || [];
    if (!assets.length) {
      screen.innerHTML = '<div class="panel"><div class="profile-row"><div class="collection-cover">' +
        (collection.cover_url ? '<img src="' + esc(collection.cover_url) + '" alt="">' : "✧") +
        '</div><div><div class="profile-name">' + esc(collection.name) + '</div><div class="profile-sub">' +
        esc(collection.description || "") + '</div></div></div></div>' +
        empty("✧", "Пока нет подарков", "Администратор ещё не добавил модели в эту коллекцию.");
      return;
    }

    const assetIds = assets.map((asset) => asset.id);
    const collectibleResult = await state.sb.from("market_collectibles")
      .select("id,asset_id,serial_number,owner_id,created_at")
      .in("asset_id", assetIds).not("owner_id", "is", null)
      .order("serial_number", { ascending: true });
    if (collectibleResult.error) throw collectibleResult.error;
    const collectibles = collectibleResult.data || [];
    const collectibleIds = collectibles.map((item) => item.id);
    let orders = [];
    if (collectibleIds.length) {
      const orderResult = await state.sb.from("market_orders")
        .select("id,collectible_id,price,user_id,side,scope,asset_id")
        .eq("side", "sell").eq("status", "open")
        .in("collectible_id", collectibleIds);
      if (orderResult.error) throw orderResult.error;
      orders = orderResult.data || [];
    }

    const assetById = new Map(assets.map((asset) => [asset.id, asset]));
    const orderByCollectible = new Map(orders.map((order) => [order.collectible_id, order]));
    state.collectionItems = collectibles.map((token) => {
      const asset = assetById.get(token.asset_id);
      if (!asset) return null;
      const metadata = asset.metadata || {};
      const listing = orderByCollectible.get(token.id) || null;
      return {
        id: token.id,
        token: token,
        asset: asset,
        serial_number: token.serial_number,
        owner_id: token.owner_id,
        listing: listing,
        minPrice: listing ? Number(listing.price) : null,
        modelFilter: String(metadata.model || metadata.variant || asset.name || "Без модели"),
        backgroundFilter: String(metadata.background || metadata.bg || "Без фона"),
        patternFilter: String(metadata.pattern || "Без узора"),
        created_at: token.created_at || asset.created_at
      };
    }).filter(Boolean);

    state.collectionFilter = { sort: "price_asc", model: "all", background: "all", pattern: "all" };
    state._collectionDetails = collection;
    renderCollectionGrid();
  }

  function renderCollectionGrid() {
    const collection = state._collectionDetails;
    const all = state.collectionItems || [];
    const filter = state.collectionFilter;
    const unique = (key) => [...new Set(all.map((item) => item[key]).filter(Boolean))].sort();
    const items = all.filter((item) =>
      (filter.model === "all" || item.modelFilter === filter.model) &&
      (filter.background === "all" || item.backgroundFilter === filter.background) &&
      (filter.pattern === "all" || item.patternFilter === filter.pattern)
    );
    items.sort((a,b) => {
      if (filter.sort === "price_desc") return (b.minPrice ?? -1) - (a.minPrice ?? -1);
      if (filter.sort === "newest") return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      if (a.minPrice === null) return 1;
      if (b.minPrice === null) return -1;
      return a.minPrice - b.minPrice;
    });
    const makeOptions = (label,key,values) => '<div class="field"><label>' + label +
      '</label><select class="select" data-filter="' + key + '"><option value="all">Все</option>' +
      values.map((value) => '<option value="' + esc(value) + '" ' + (filter[key] === value ? "selected" : "") +
        '>' + esc(value) + '</option>').join("") + '</select></div>';
    const cards = items.map((item) => {
      const asset = item.asset;
      const isMine = item.owner_id === state.user.id;
      const label = item.listing
        ? "★ " + fmt(item.listing.price)
        : (isMine ? "Мой NFT" : "Нет предложения");
      return '<button class="gift-card" type="button" data-action="open-collectible" data-id="' + item.id + '">' +
        mediaHtml(asset) +
        '<div class="serial-ribbon">#' + esc(item.serial_number) + '</div>' +
        '<div class="gift-card-body"><div class="gift-title">' + esc(asset.name) + '</div>' +
        '<div class="gift-meta">' + esc(asset.rarity || "Коллекционный подарок") +
        (isMine ? " · Ваш экземпляр" : "") + '</div>' +
        '<span class="price-pill">' + label + '</span></div></button>';
    }).join("");
    screen.innerHTML = '<div class="section-heading"><h2>' + esc(collection.name) +
      '</h2><span class="section-note">' + items.length + " экземпляров</span></div>" +
      '<div class="panel"><div class="form-grid">' +
      '<div class="field"><label>Цена</label><select class="select" data-filter="sort">' +
      '<option value="price_asc">Сначала дешевле</option><option value="price_desc">Сначала дороже</option>' +
      '<option value="newest">Сначала новые</option></select></div>' +
      makeOptions("Модель","model",unique("modelFilter")) +
      makeOptions("Фон","background",unique("backgroundFilter")) +
      makeOptions("Узор","pattern",unique("patternFilter")) +
      '</div></div>' +
      (cards ? '<div class="gift-grid">' + cards + '</div>' : empty("⌕","Ничего не найдено","Измените параметры фильтрации."));
    const sortSelect = screen.querySelector('[data-filter="sort"]');
    if (sortSelect) sortSelect.value = filter.sort;
  }

  async function openCollectible(collectibleId) {
    const result = await state.sb.from("market_collectibles")
      .select("id,asset_id").eq("id", collectibleId).maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) throw new Error("Экземпляр NFT не найден");
    return openAsset(result.data.asset_id, result.data.id);
  }

  async function openAsset(id, selectedCollectibleId) {
    if (state.view !== "asset") {
      state.assetReturnView = state.view;
      state.assetReturnCollection = state.currentCollection;
    }
    state.currentAsset = id;
    if (selectedCollectibleId) state.currentCollectible = selectedCollectibleId;
    state.view = "asset";
    const returnView = state.assetReturnView;
    const returnCollection = state.assetReturnCollection;
    state.back = () => {
      if (returnView === "inventory") return openInventory(returnCollection);
      if (returnView === "collection") return openCollection(returnCollection);
      if (returnView === "my_nft") return renderMyNft();
      return renderMarket();
    };
    setHeader("Подарок", "Предложения и график цены", true);
    loading("Загружаем подарок…");
    const assetResult = await state.sb.from("market_assets")
      .select("id,name,description,image_url,model_url,rarity,initial_price,max_supply,collection_id,gift_type_id")
      .eq("id", id).maybeSingle();
    if (assetResult.error) throw assetResult.error;
    const asset = assetResult.data;
    if (!asset) throw new Error("Подарок не найден");
    const tokensResult = await state.sb.from("market_collectibles")
      .select("id,serial_number,owner_id").eq("asset_id", id).order("serial_number", { ascending: true });
    if (tokensResult.error) throw tokensResult.error;
    const tokens = tokensResult.data || [];
    const tokenIds = tokens.map((token) => token.id);
    let orders = [];
    if (tokenIds.length) {
      const ordersResult = await state.sb.from("market_orders")
        .select("id,collectible_id,price,user_id,side,scope,asset_id").eq("status", "open").in("collectible_id", tokenIds);
      if (ordersResult.error) throw ordersResult.error;
      orders = ordersResult.data || [];
    }
    const selectedToken = tokens.find((token) => token.id === state.currentCollectible) || null;
    const rows = tokens.map((token) => {
      const sellOrder = orders.filter((order) => order.collectible_id === token.id && order.side === "sell")
        .sort((a,b) => Number(a.price)-Number(b.price))[0];
      const isOwner = token.owner_id === state.user.id;
      let actionHtml = "";
      if (sellOrder && !isOwner) {
        actionHtml = '<button class="button primary small" type="button" data-action="buy-listing" data-id="' +
          token.id + '" data-price="' + sellOrder.price + '">Купить ' + fmt(sellOrder.price) + "</button>";
      } else if (isOwner && !sellOrder) {
        actionHtml = '<form class="mini-order-form" data-form="sell" data-id="' + token.id + '">' +
          '<input class="input" name="price" type="number" min="1" step="1" placeholder="Цена" required>' +
          '<button class="button small" type="submit">Продать</button></form>';
      } else if (!isOwner && !sellOrder) {
        actionHtml = '<span class="badge">Нет предложения</span>';
      } else if (isOwner && sellOrder) {
        actionHtml = '<button class="button ghost small" type="button" data-action="cancel-order" data-id="' +
          sellOrder.id + '">Снять с продажи</button>';
      } else {
        actionHtml = '<span class="badge green">Ваша заявка</span>';
      }
      const ownerText = isOwner ? "Ваш экземпляр" : (sellOrder ? "Выставлен на продажу" : "Нет предложения");
      return '<div class="instance-row"><div class="instance-number">#' + esc(token.serial_number) +
        '</div><div class="instance-info"><div class="instance-name">' + esc(asset.name) +
        '</div><div class="instance-sub">' + ownerText + (sellOrder ? " · " + fmt(sellOrder.price) : "") +
        "</div></div><div class=\"instance-actions\">" + actionHtml + "</div></div>";
    }).join("");
    const assetBids = orders.filter((order) => order.side === "buy" && order.scope === "asset");
    const bestBid = assetBids.slice().sort((a,b) => Number(b.price)-Number(a.price))[0];
    const myBid = assetBids.find((order) => order.user_id === state.user.id);
    let bidPanel = "";
    if (tokens.length && state.access && state.access.can_trade !== false) {
      bidPanel = '<div class="panel"><h3>Заявка на покупку этой модели</h3>' +
        '<div class="stat-row"><span>Лучшая заявка</span><strong>' +
        (bestBid ? fmt(bestBid.price) : "Пока нет") + '</strong></div>' +
        (myBid
          ? '<div class="helper">Ваша заявка: ' + fmt(myBid.price) + '. Средства зарезервированы до исполнения или отмены.</div>' +
            '<button class="button ghost full" style="margin-top:9px" type="button" data-action="cancel-order" data-id="' + myBid.id + '">Отменить мою заявку</button>'
          : '<form class="form-grid" data-form="asset-bid" data-id="' + tokens[0].id + '">' +
            '<div class="field"><label>Максимальная цена покупки</label><input class="input" name="price" type="number" min="1" step="1" required placeholder="Укажите цену"></div>' +
            '<button class="button primary full" type="submit">Создать заявку</button></form>') +
        '<div class="helper">Заявка действует на любой экземпляр этой модели. Когда продавец выставит подходящий по цене NFT, заявка исполнится автоматически.</div></div>';
    } else if (tokens.length) {
      bidPanel = '<div class="warning-box">Создание заявок на покупку для этого аккаунта ограничено.</div>';
    }
    const controls = state.access && state.access.can_trade !== false
      ? '<div class="helper">Покупка по объявлению — конкретного экземпляра. Заявка выше относится ко всей модели.</div>'
      : '<div class="warning-box">Торговля для этого аккаунта ограничена.</div>';
    screen.innerHTML =
      '<div class="panel asset-hero">' + mediaHtml(asset) +
      '<div><div class="gift-title">' + esc(asset.name) + '</div><div class="asset-description">' +
      esc(asset.description || "Коллекционный цифровой подарок") + '</div>' +
      '<div class="price-pill">' + esc(asset.rarity || "Коллекционный") + "</div>" +
      (selectedToken ? '<div class="asset-description">Выбран экземпляр #' + esc(selectedToken.serial_number) + '</div>' : "") +
      '</div></div>' +
      '<div class="panel"><div class="stat-row"><span>Редкость</span><strong>' + esc(asset.rarity || "—") +
      '</strong></div><div class="stat-row"><span>Тираж</span><strong>' + fmt(asset.max_supply) +
      '</strong></div><div class="stat-row"><span>Начальная цена</span><strong>' + fmt(asset.initial_price) +
      '</strong></div><div class="stat-row"><span>Экземпляров создано</span><strong>' + tokens.length +
      "</strong></div></div>" +
      bidPanel +
      '<div class="section-heading"><h2>График цены</h2><span class="section-note">По совершённым сделкам</span></div>' +
      '<div class="chart-wrap"><div class="chart-times">' +
      ["1m","5m","15m","1h","4h","1d"].map((tf) => '<button type="button" data-action="timeframe" data-tf="' + tf +
        '" class="' + (state.currentTimeframe === tf ? "active" : "") + '">' + tf + "</button>").join("") +
      '</div><div id="price-chart" class="chart-empty">Загружаем историю…</div></div>' +
      '<div class="section-heading"><h2>Экземпляры</h2><span class="section-note">' + tokens.length + " шт.</span></div>" +
      controls + (rows ? '<div class="instance-list">' + rows + "</div>" :
        empty("✧", "Экземпляров пока нет", "Администратор может выпустить экземпляры этой модели через панель управления."));
    await loadChart(id, state.currentTimeframe);
  }

  async function loadChart(assetId, timeframe) {
    const chart = document.getElementById("price-chart");
    if (!chart) return;
    const result = await state.sb.from("market_price_candles")
      .select("bucket,open_price,high_price,low_price,close_price,volume,trade_count")
      .eq("asset_id", assetId).eq("timeframe", timeframe)
      .order("bucket", { ascending: true }).limit(120);
    if (result.error) throw result.error;
    const candles = result.data || [];
    if (!candles.length) {
      chart.className = "chart-empty";
      chart.textContent = "График появится после первых совершённых сделок. Исторические цены не генерируются.";
      return;
    }
    chart.className = "";
    const width = 760, height = 220, left = 10, right = 10, top = 10, bottom = 10;
    const lows = candles.map((c) => Number(c.low_price));
    const highs = candles.map((c) => Number(c.high_price));
    let min = Math.min.apply(null, lows), max = Math.max.apply(null, highs);
    if (min === max) { min -= 1; max += 1; }
    const y = (price) => top + (max - price) / (max - min) * (height - top - bottom);
    const slot = (width - left - right) / candles.length;
    const bodyWidth = Math.max(2, Math.min(12, slot * .58));
    let svg = '<svg viewBox="0 0 ' + width + " " + height + '" role="img" aria-label="Свечной график цены">';
    for (let i=0;i<4;i++) {
      const gy = top + i * (height - top - bottom) / 3;
      svg += '<line class="chart-grid" x1="' + left + '" y1="' + gy + '" x2="' + (width-right) + '" y2="' + gy + '"/>';
    }
    candles.forEach((c, i) => {
      const x = left + slot * i + slot / 2;
      const open = Number(c.open_price), close = Number(c.close_price);
      const high = Number(c.high_price), low = Number(c.low_price);
      const up = close >= open;
      const yOpen = y(open), yClose = y(close);
      const bodyY = Math.min(yOpen,yClose);
      const bodyH = Math.max(2,Math.abs(yOpen-yClose));
      const klass = up ? "chart-up" : "chart-down";
      svg += '<line class="' + klass + '" x1="' + x + '" y1="' + y(high) + '" x2="' + x + '" y2="' + y(low) + '" stroke-width="1.5"/>';
      svg += '<rect class="' + klass + '" x="' + (x-bodyWidth/2) + '" y="' + bodyY + '" width="' + bodyWidth + '" height="' + bodyH + '" rx="1"/>';
    });
    svg += "</svg>";
    chart.innerHTML = svg;
  }

  async function renderMyNft() {
    state.view = "my_nft";
    state.back = null;
    setHeader("Мои NFT", "Ваши коллекции", false);
    loading("Загружаем вашу коллекцию…");
    const ownedResult = await state.sb.from("market_collectibles")
      .select("id,serial_number,asset_id,owner_id").eq("owner_id", state.user.id)
      .order("created_at", { ascending: false });
    if (ownedResult.error) throw ownedResult.error;
    const owned = ownedResult.data || [];
    state.inventory = [];
    if (!owned.length) {
      screen.innerHTML = empty("✧", "У вас пока нет NFT", "Купленные подарки будут автоматически группироваться здесь по коллекциям.");
      return;
    }
    const assetIds = [...new Set(owned.map((item) => item.asset_id))];
    const assetsResult = await state.sb.from("market_assets")
      .select("id,name,image_url,model_url,rarity,collection_id").in("id", assetIds);
    if (assetsResult.error) throw assetsResult.error;
    const assets = assetsResult.data || [];
    const collectionIds = [...new Set(assets.map((item) => item.collection_id))];
    const collectionsResult = await state.sb.from("market_collections")
      .select("id,name,cover_url,slug").in("id", collectionIds);
    if (collectionsResult.error) throw collectionsResult.error;
    const collections = collectionsResult.data || [];
    state.inventory = owned.map((item) => {
      const asset = assets.find((a) => a.id === item.asset_id);
      const collection = asset ? collections.find((c) => c.id === asset.collection_id) : null;
      return Object.assign({}, item, { asset: asset || {}, collection: collection || {} });
    });
    const groups = collections.map((collection) => {
      const items = state.inventory.filter((item) => item.collection.id === collection.id);
      if (!items.length) return "";
      const preview = items[0].asset;
      return '<button class="collection-card" type="button" data-action="open-inventory" data-id="' + collection.id + '">' +
        '<div class="collection-cover">' + (collection.cover_url ? '<img src="' + esc(collection.cover_url) + '" alt="">' :
          (preview.image_url ? '<img src="' + esc(preview.image_url) + '" alt="">' : "✧")) + '</div>' +
        '<div class="collection-info"><div class="collection-name">' + esc(collection.name) + '</div>' +
        '<div class="collection-desc">Ваша коллекция</div><div class="collection-count">' + items.length +
        " NFT</div></div><span class=\"arrow\">›</span></button>";
    }).join("");
    screen.innerHTML = '<div class="section-heading"><h2>Коллекции</h2><span class="section-note">' +
      collections.length + " коллекций</span></div><div class=\"collection-list\">" + groups + "</div>";
  }

  function openInventory(collectionId) {
    const collection = state.inventory.find((item) => item.collection.id === collectionId);
    if (!collection) return;
    const items = state.inventory.filter((item) => item.collection.id === collectionId);
    state.currentCollection = collectionId;
    state.view = "inventory";
    state.back = () => renderMyNft();
    setHeader(collection.collection.name, "Ваша коллекция", true);
    screen.innerHTML = '<div class="section-heading"><h2>' + esc(collection.collection.name) +
      '</h2><span class="section-note">' + items.length + " NFT</span></div><div class=\"gift-grid\">" +
      items.map((item) => '<button type="button" class="gift-card" data-action="open-owned-asset" data-id="' +
        item.id + '">' + mediaHtml(item.asset) +
        '<div class="gift-card-body"><div class="gift-title">' + esc(item.asset.name) +
        '</div><div class="gift-meta">Экземпляр #' + esc(item.serial_number) +
        '</div><span class="price-pill">Мой NFT</span></div></button>').join("") +
      "</div>";
  }

  async function renderSettings() {
    state.view = "settings";
    state.back = null;
    setHeader("Настройки", "Параметры аккаунта", false);
    const profile = state.profile || {};
    const avatar = profile.avatar_url
      ? '<img src="' + esc(profile.avatar_url) + '" alt="">'
      : esc((profile.display_name || "U").slice(0,1).toUpperCase());
    screen.innerHTML =
      '<div class="panel"><div class="profile-row"><div class="avatar">' + avatar + '</div><div><div class="profile-name">' +
      esc(profile.display_name || "Пользователь") + '</div><div class="profile-sub">' +
      (profile.handle ? "@" + esc(profile.handle) + " · " : "") + "Telegram ID: " +
      esc((state.user.app_metadata && state.user.app_metadata.telegram_id) || "—") + "</div></div></div></div>" +
      '<div class="section-heading"><h2>Основные</h2></div><div class="settings-list">' +
      '<div class="settings-item"><span class="settings-icon">◐</span><div class="settings-label">Тёмная тема' +
      '<span class="settings-desc">По умолчанию используется светлая тема</span></div><input class="toggle" type="checkbox" data-setting="theme" ' +
      (state.preferences.theme === "dark" ? "checked" : "") + '></div>' +
      '<div class="settings-item"><span class="settings-icon">♧</span><div class="settings-label">Уведомления' +
      '<span class="settings-desc">Системные сообщения площадки</span></div><input class="toggle" type="checkbox" data-setting="notifications_enabled" ' +
      (state.preferences.notifications_enabled ? "checked" : "") + '></div>' +
      '<div class="settings-item"><span class="settings-icon">⌁</span><div class="settings-label">Уведомления о цене' +
      '<span class="settings-desc">Изменения заявок и торгов</span></div><input class="toggle" type="checkbox" data-setting="price_alerts_enabled" ' +
      (state.preferences.price_alerts_enabled ? "checked" : "") + '></div></div>' +
      '<div class="section-heading"><h2>Аккаунт</h2></div><div class="settings-list">' +
      '<div class="settings-item"><span class="settings-icon">◉</span><div class="settings-label">Telegram ID' +
      '<span class="settings-desc">' + esc((state.user.app_metadata && state.user.app_metadata.telegram_id) || "—") + "</span></div></div>" +
      '<button class="settings-item" type="button" data-action="my-orders"><span class="settings-icon">↔</span><span class="settings-label">Мои заявки' +
      '<span class="settings-desc">Открытые заявки на покупку и продажу</span></span><span class="arrow">›</span></button>' +
      '<div class="settings-item"><span class="settings-icon">ⓘ</span><span class="settings-label">О приложении' +
      '<span class="settings-desc">Gift Market · Telegram Mini App</span></span></div></div>' +
      (state.isAdmin ? '<div class="section-heading"><h2>Администрирование</h2></div><div class="settings-list">' +
        '<button class="settings-item" type="button" data-action="admin-open"><span class="settings-icon">⬡</span>' +
        '<span class="settings-label">Панель администратора<span class="settings-desc">Управление площадкой и пользователями</span></span><span class="arrow">›</span></button></div>' : "");
  }

  async function renderMyOrders() {
    state.view = "my_orders";
    state.back = () => renderSettings();
    setHeader("Мои заявки", "Открытые ордера", true);
    loading("Загружаем заявки…");
    const result = await state.sb.from("market_orders")
      .select("id,collectible_id,side,scope,price,status,created_at,reserved_amount")
      .eq("user_id", state.user.id).eq("status", "open")
      .order("created_at", { ascending: false });
    if (result.error) throw result.error;
    const orders = result.data || [];
    if (!orders.length) {
      screen.innerHTML = empty("↔", "Открытых заявок нет", "Когда вы создадите заявку на покупку или выставите NFT на продажу, она появится здесь.");
      return;
    }
    const items = await state.sb.from("market_collectibles").select("id,serial_number,asset_id").in("id", orders.map((o) => o.collectible_id));
    if (items.error) throw items.error;
    const assetIds = [...new Set((items.data || []).map((i) => i.asset_id))];
    const assets = assetIds.length ? await state.sb.from("market_assets").select("id,name").in("id",assetIds) : {data:[]};
    if (assets.error) throw assets.error;
    screen.innerHTML = '<div class="instance-list">' + orders.map((order) => {
      const item = (items.data || []).find((i) => i.id === order.collectible_id);
      const asset = item && (assets.data || []).find((a) => a.id === item.asset_id);
      return '<div class="instance-row"><div class="instance-number">#' + esc(item ? item.serial_number : "—") +
        '</div><div class="instance-info"><div class="instance-name">' + esc(asset ? asset.name : "NFT") +
        '</div><div class="instance-sub">' + (order.side === "buy" ? (order.scope === "asset" ? "Заявка на модель" : "Заявка на покупку") : "Выставлен на продажу") +
        " · " + fmt(order.price) + "</div></div><button class=\"button ghost small\" type=\"button\" data-action=\"cancel-order\" data-id=\"" +
        order.id + "\">Отменить</button></div>";
    }).join("") + "</div>";
  }

  async function renderAdminHome() {
    state.view = "admin";
    state.back = () => renderSettings();
    setHeader("Админ-панель", "Управление маркетплейсом", true);
    loading("Загружаем статистику…");
    const stats = await api("admin_overview");
    screen.innerHTML =
      '<div class="admin-banner"><div><strong>Панель администратора</strong><small>Доступ подтверждён сервером</small></div><span>⬡</span></div>' +
      '<div class="admin-grid">' +
      '<div class="admin-tile"><div class="admin-tile-icon">♙</div><strong>' + fmt(stats.users) + '</strong><span>Пользователи</span></div>' +
      '<div class="admin-tile"><div class="admin-tile-icon">↔</div><strong>' + fmt(stats.trades) + '</strong><span>Сделки</span></div>' +
      '<div class="admin-tile"><div class="admin-tile-icon">✧</div><strong>' + fmt(stats.collections) + '</strong><span>Коллекции</span></div>' +
      '<div class="admin-tile"><div class="admin-tile-icon">▣</div><strong>' + fmt(stats.collectibles) + '</strong><span>Экземпляры NFT</span></div>' +
      '<div class="admin-tile"><div class="admin-tile-icon">◈</div><strong>' + fmt(stats.open_orders) + '</strong><span>Открытые заявки</span></div>' +
      '<div class="admin-tile"><div class="admin-tile-icon">₽</div><strong>' + fmt(stats.fees) + '</strong><span>Комиссия площадки</span></div>' +
      '<div class="admin-tile"><div class="admin-tile-icon">▤</div><strong>' + fmt(stats.trade_volume) + '</strong><span>Объём торгов</span></div></div>' +
      '<div class="admin-menu">' +
      '<button type="button" data-action="admin-users"><span>♙</span><span>Пользователи<small>Поиск, баланс, блокировки и история</small></span><b>›</b></button>' +
      '<button type="button" data-action="admin-catalog"><span>✧</span><span>Коллекции и NFT<small>Создание коллекций и подарков вручную</small></span><b>›</b></button>' +
      '<button type="button" data-action="admin-market"><span>▥</span><span>Рынок и торговля<small>Пауза торгов и комиссия</small></span><b>›</b></button>' +
      '<button type="button" data-action="admin-audit"><span>≡</span><span>Журнал действий<small>Изменения и операции администраторов</small></span><b>›</b></button></div>';
  }

  async function renderAdminUsers() {
    state.view = "admin_users";
    state.back = () => renderAdminHome();
    setHeader("Пользователи", "Поиск по Telegram и аккаунту", true);
    screen.innerHTML =
      '<div class="panel"><form data-form="admin-search" class="form-grid">' +
      '<div class="field"><label>Telegram ID, @username, имя или внутренний ID</label>' +
      '<input class="input" name="search" placeholder="Например, 123456789 или @username" minlength="2"></div>' +
      '<button class="button primary full" type="submit">Найти пользователя</button></form></div>' +
      '<div id="admin-user-results"></div>';
    await searchAdminUsers("");
  }

  async function searchAdminUsers(search) {
    const box = document.getElementById("admin-user-results");
    if (!box) return;
    box.innerHTML = '<div class="loading-state"><div class="loader"></div><span>Поиск…</span></div>';
    const users = await api("admin_users", { search: search });
    if (!users || !users.length) {
      box.innerHTML = empty("⌕", "Ничего не найдено", "Проверьте Telegram ID, username или имя.");
      return;
    }
    box.innerHTML = '<div class="panel"><div class="section-heading"><h2>Результаты</h2><span class="section-note">' +
      users.length + " найдено</span></div>" + users.map((user) => {
        const restrictions = user.restrictions || [];
        const blocked = restrictions.some((r) => r.type === "full_access");
        return '<button class="user-result" type="button" data-action="admin-open-user" data-id="' + user.id + '">' +
          '<div class="avatar">' + (user.avatar_url ? '<img src="' + esc(user.avatar_url) + '" alt="">' :
            esc((user.display_name || "U").slice(0,1).toUpperCase())) + '</div><div class="user-result-main">' +
          '<div class="user-result-name"><span class="status-dot ' + (blocked ? "blocked" : "") + '"></span>' +
          esc(user.display_name || "Пользователь") + '</div><div class="user-result-sub">' +
          (user.telegram_username ? "@" + esc(user.telegram_username) + " · " : "") +
          "TG: " + esc(user.telegram_id || "—") + "<br>Баланс: " + fmt(user.balance) +
          " · NFT: " + fmt(user.nft_count) + "</div></div><span class=\"arrow\">›</span></button>";
      }).join("") + "</div>";
  }

  async function openAdminUser(id) {
    state.view = "admin_user";
    state.adminSelectedUser = id;
    state.back = () => renderAdminUsers();
    setHeader("Пользователь", "Управление аккаунтом", true);
    loading("Загружаем профиль…");
    const user = await api("admin_user_details", { user_id: id });
    state._adminUser = user;
    const restrictions = user.restrictions || [];
    const active = restrictions.filter((r) => !r.lifted_at && (!r.ends_at || new Date(r.ends_at) > new Date()));
    const ledger = user.ledger || [];
    screen.innerHTML =
      '<div class="panel"><div class="profile-row"><div class="avatar">' +
      (user.avatar_url ? '<img src="' + esc(user.avatar_url) + '" alt="">' : esc((user.display_name || "U").slice(0,1))) +
      '</div><div><div class="profile-name">' + esc(user.display_name || "Пользователь") +
      '</div><div class="profile-sub">' + (user.telegram_username ? "@" + esc(user.telegram_username) + " · " : "") +
      "Telegram ID: " + esc(user.telegram_id || "—") + "</div></div></div>" +
      '<div class="stat-row"><span>Внутренний ID</span><strong>' + esc(user.id) + '</strong></div>' +
      '<div class="stat-row"><span>Баланс</span><strong>' + fmt(user.balance) + '</strong></div>' +
      '<div class="stat-row"><span>Зарезервировано</span><strong>' + fmt(user.reserved_balance) + '</strong></div>' +
      '<div class="stat-row"><span>NFT</span><strong>' + fmt(user.nft_count) + '</strong></div>' +
      '<div class="stat-row"><span>Сделки</span><strong>' + fmt(user.trade_count) + '</strong></div></div>' +
      '<div class="panel"><h3>Изменить баланс</h3><form class="form-grid" data-form="balance-adjust">' +
      '<div class="field"><label>Сумма (положительная — начислить, отрицательная — списать)</label><input class="input" type="number" name="amount" step="1" required placeholder="Например, 500 или -200"></div>' +
      '<div class="field"><label>Причина операции</label><input class="input" name="reason" minlength="3" maxlength="500" required placeholder="Причина изменения баланса"></div>' +
      '<button class="button primary full" type="submit">Применить изменение</button></form></div>' +
      '<div class="panel"><h3>Ограничения аккаунта</h3>' +
      (active.length ? active.map((r) => '<div class="restriction-item"><strong>' + esc(restrictionName(r.type)) +
        '</strong>' + esc(r.reason) + '<div class="helper">' + (r.ends_at ? "До " + new Date(r.ends_at).toLocaleString("ru-RU") : "Без срока") +
        "</div></div>").join("") : '<div class="helper">Активных ограничений нет.</div>') +
      '<form class="form-grid" data-form="restriction" style="margin-top:12px">' +
      '<div class="field"><label>Тип ограничения</label><select class="select" name="type">' +
      '<option value="full_access">Полная блокировка</option><option value="trading">Запрет торговли</option>' +
      '<option value="listing">Запрет выставления NFT</option><option value="wallet">Заморозка баланса</option>' +
      '<option value="collectibles">Заморозка NFT</option></select></div>' +
      '<div class="field"><label>Срок</label><select class="select" name="duration">' +
      '<option value="60">1 час</option><option value="1440">24 часа</option><option value="10080">7 дней</option>' +
      '<option value="43200">30 дней</option><option value="null">Навсегда</option></select></div>' +
      '<div class="field"><label>Причина</label><input class="input" name="reason" minlength="3" maxlength="500" required placeholder="Причина ограничения"></div>' +
      '<button class="button danger full" type="submit">Установить ограничение</button></form>' +
      '<button class="button soft full" style="margin-top:9px" type="button" data-action="admin-lift-all" data-id="' + user.id + '">Снять все активные ограничения</button></div>' +
      '<div class="panel"><h3>Последние операции баланса</h3>' +
      (ledger.length ? ledger.map((entry) => '<div class="stat-row"><span>' + esc(entry.reason || entry.type) +
        '<small class="helper" style="display:block">' + new Date(entry.created_at).toLocaleString("ru-RU") + "</small></span><strong>" +
        (Number(entry.amount) > 0 ? "+" : "") + fmt(entry.amount) + "</strong></div>").join("") :
        '<div class="helper">Операций пока нет.</div>') + "</div>";
  }
  function restrictionName(type) {
    return ({
      full_access: "Полная блокировка",
      trading: "Запрет торговли",
      listing: "Запрет выставления",
      wallet: "Заморозка баланса",
      collectibles: "Заморозка NFT"
    })[type] || type;
  }

  async function loadAdminCatalog() {
    const catalog = await api("admin_catalog");
    state.adminCollections = catalog.collections || [];
    state.adminGiftTypes = catalog.gift_types || [];
    state.adminVariants = catalog.variants || [];
  }
  async function renderAdminCatalog() {
    state.view = "admin_catalog";
    state.back = () => renderAdminHome();
    setHeader("Коллекции и NFT", "Создание вручную", true);
    loading("Загружаем каталог…");
    await loadAdminCatalog();
    const collections = state.adminCollections;
    const gifts = state.adminGiftTypes;
    const variants = state.adminVariants;
    const statusButton = (type,item) => '<button class="button small ghost" type="button" data-action="catalog-status" data-type="' + type +
      '" data-id="' + item.id + '" data-status="' + (item.status === "published" ? "draft" : "published") + '">' +
      (item.status === "published" ? "Снять с публикации" : "Опубликовать") + '</button>';
    const collectionOptions = collections.map((c) => '<option value="' + c.id + '">' + esc(c.name) + "</option>").join("");
    const giftOptions = gifts.map((g) => '<option value="' + g.id + '">' + esc(g.name) + "</option>").join("");
    screen.innerHTML =
      '<div class="panel"><h3>Создать коллекцию</h3><form class="form-grid" data-form="create-collection">' +
      '<div class="field"><label>Название</label><input class="input" name="name" maxlength="80" required placeholder="Название коллекции"></div>' +
      '<div class="field"><label>Описание</label><textarea class="textarea" name="description" maxlength="2000" placeholder="Описание"></textarea></div>' +
      '<div class="field"><label>Обложка URL</label><input class="input" name="cover_url" type="url" placeholder="https://..."></div>' +
      '<div class="field"><label>Статус</label><select class="select" name="status"><option value="draft">Черновик</option><option value="published">Опубликована</option></select></div>' +
      '<button class="button primary full" type="submit">Создать коллекцию</button></form></div>' +
      '<div class="panel"><h3>Добавить модель подарка</h3><form class="form-grid" data-form="create-gift">' +
      '<div class="field"><label>Коллекция</label><select class="select" name="collection_id" required>' +
      (collectionOptions || '<option value="">Сначала создайте коллекцию</option>') + '</select></div>' +
      '<div class="field"><label>Название модели</label><input class="input" name="name" maxlength="80" required placeholder="Например, Fighter Series"></div>' +
      '<div class="field"><label>Описание</label><textarea class="textarea" name="description" maxlength="2000"></textarea></div>' +
      '<div class="field"><label>Обложка URL</label><input class="input" type="url" name="cover_url" placeholder="https://..."></div>' +
      '<div class="field"><label>Статус</label><select class="select" name="status"><option value="draft">Черновик</option><option value="published">Опубликована</option></select></div>' +
      '<button class="button primary full" type="submit" ' + (!collections.length ? "disabled" : "") + '>Добавить модель</button></form></div>' +
      '<div class="panel"><h3>Создать NFT-модель</h3><form class="form-grid" data-form="create-variant">' +
      '<div class="field"><label>Модель подарка</label><select class="select" name="gift_type_id" required>' +
      (giftOptions || '<option value="">Сначала добавьте модель подарка</option>') + '</select></div>' +
      '<div class="field"><label>Название NFT</label><input class="input" name="name" maxlength="120" required placeholder="Название варианта"></div>' +
      '<div class="field"><label>Модель для фильтра</label><input class="input" name="model_name" maxlength="80" placeholder="Например, Хамзат Чимаев"></div>' +
      '<div class="form-row"><div class="field"><label>Фон</label><input class="input" name="background" maxlength="80" placeholder="Синий"></div>' +
      '<div class="field"><label>Узор</label><input class="input" name="pattern" maxlength="80" placeholder="Звёзды"></div></div>' +
      '<div class="form-row"><div class="field"><label>Редкость</label><input class="input" name="rarity" maxlength="40" required placeholder="Rare"></div>' +
      '<div class="field"><label>Начальная цена</label><input class="input" name="initial_price" type="number" min="0" step="1" required value="0"></div></div>' +
      '<div class="form-row"><div class="field"><label>Максимальный тираж</label><input class="input" name="max_supply" type="number" min="1" required value="100"></div>' +
      '<div class="field"><label>Создать экземпляров</label><input class="input" name="mint_quantity" type="number" min="0" required value="0"></div></div>' +
      '<div class="field"><label>Изображение или анимация — GIF, WebP, MP4, WebM</label><input class="input" name="image_file" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime"></div>' +
      '<div class="field"><label>Или URL изображения / анимации</label><input class="input" name="image_url" type="url" placeholder="https://..."></div>' +
      '<div class="field"><label>3D-модель GLB (файл)</label><input class="input" name="model_file" type="file" accept=".glb,model/gltf-binary,application/octet-stream"></div>' +
      '<div class="field"><label>Или URL 3D-модели GLB</label><input class="input" name="model_url" type="url" placeholder="https://.../gift.glb"></div>' +
      '<div class="helper">Файлы загружаются в защищённое хранилище. Максимальный размер — 25 МБ.</div>' +
      '<div class="field"><label>Статус</label><select class="select" name="status"><option value="draft">Черновик</option><option value="published">Опубликован</option></select></div>' +
      '<div class="helper">Ничего не создаётся автоматически. Тираж по умолчанию 0: укажите количество экземпляров только при необходимости.</div>' +
      '<button class="button primary full" type="submit" ' + (!gifts.length ? "disabled" : "") + '>Создать NFT</button></form></div>' +
      '<div class="panel"><h3>Существующие коллекции</h3>' +
      (collections.length ? collections.map((c) => '<div class="stat-row"><span>' + esc(c.name) + '<small class="helper" style="display:block">' +
        esc(c.slug) + "</small></span><span><span class=\"badge\">" + esc(c.status) + "</span> " + statusButton("collection",c) + "</span></div>").join("") :
        '<div class="helper">Коллекции ещё не созданы.</div>') + "</div>" +
      '<div class="panel"><h3>Модели и NFT</h3>' +
      (gifts.length ? gifts.map((g) => '<div class="stat-row"><span>' + esc(g.name) + '<small class="helper" style="display:block">' +
        esc(g.slug) + "</small></span><span><span class=\"badge\">" + esc(g.status) + "</span> " + statusButton("gift_type",g) + "</span></div>").join("") :
        '<div class="helper">Модели подарков ещё не созданы.</div>') +
      (variants.length ? variants.map((v) =>
        '<div class="panel"><div class="stat-row"><span>' + esc(v.name) +
        '<small class="helper" style="display:block">' + esc(v.rarity || "") +
        " · тираж " + esc(v.max_supply) + "</small></span><span><span class=\"badge\">" +
        esc(v.status) + "</span> " + statusButton("asset",v) + "</span></div>" +
        '<form class="form-row" data-form="mint-asset" data-id="' + v.id + '">' +
        '<input class="input" type="number" name="quantity" min="1" max="1000" step="1" required placeholder="Количество">' +
        '<button class="button small" type="submit">Выпустить ещё</button></form></div>').join("") :
        '<div class="helper">NFT-модели ещё не созданы.</div>') +
      "</div>";
  }

  async function renderAdminMarket() {
    state.view = "admin_market";
    state.back = () => renderAdminHome();
    setHeader("Рынок и торговля", "Управление площадкой", true);
    const settings = await api("admin_get_settings");
    screen.innerHTML =
      '<div class="panel"><h3>Торговля</h3><div class="stat-row"><span>Статус рынка</span><strong>' +
      (settings.trading_enabled ? "Включён" : "Приостановлен") + '</strong></div>' +
      '<button class="button ' + (settings.trading_enabled ? "danger" : "primary") + ' full" type="button" data-action="toggle-trading" data-enabled="' +
      (!settings.trading_enabled) + '">' + (settings.trading_enabled ? "Приостановить торги" : "Возобновить торги") + "</button></div>" +
      '<div class="panel"><h3>Комиссия маркетплейса</h3><form class="form-grid" data-form="admin-commission">' +
      '<div class="field"><label>Комиссия за сделку, % (от 0 до 10)</label><input class="input" name="commission" type="number" min="0" max="10" step="0.1" required value="' +
      (Number(settings.commission_bps || 0) / 100).toFixed(1) + '"></div>' +
      '<button class="button primary full" type="submit">Сохранить комиссию</button></form>' +
      '<div class="helper">Комиссия удерживается из суммы продавца и отдельно учитывается в журнале площадки.</div></div>' +
      '<div class="helper">Приостановка блокирует новые торговые операции. Открытые заявки сохраняются.</div>';
  }

  async function renderAdminAudit() {
    state.view = "admin_audit";
    state.back = () => renderAdminHome();
    setHeader("Журнал действий", "История операций администратора", true);
    loading("Загружаем журнал…");
    const rows = await api("admin_audit", { limit: 75 });
    screen.innerHTML = rows && rows.length ? '<div class="panel">' + rows.map((row) =>
      '<div class="stat-row"><span><strong>' + esc(row.action) + '</strong><small class="helper" style="display:block">' +
      esc(row.target_type || "—") + " · " + esc(row.target_id || "") + "</small><small class=\"helper\">" +
      new Date(row.created_at).toLocaleString("ru-RU") + "</small></span></div>").join("") + "</div>" :
      empty("≡", "Журнал пока пуст", "Административные действия будут отображаться здесь.");
  }

  async function submitOrder(collectibleId, side, price, scope) {
    if (!state.access.can_trade) throw new Error("Торговля для этого аккаунта ограничена");
    if (side === "sell" && !state.access.can_list) throw new Error("Выставление NFT запрещено для этого аккаунта");
    const result = await api("submit_order", {
      collectible_id: collectibleId,
      side: side,
      scope: scope || "collectible",
      price: Number(price),
      idempotency_key: crypto.randomUUID()
    });
    await refreshWalletOnly();
    toast(result && result.status === "filled" ? "Сделка исполнена" : "Заявка создана");
    return result;
  }
  async function refreshWalletOnly() {
    const result = await state.sb.from("market_wallets")
      .select("user_id,balance,reserved_balance,currency_code").eq("user_id", state.user.id).maybeSingle();
    if (result.error) throw result.error;
    state.wallet = result.data || state.wallet;
    setBalance();
  }

  async function handleClick(button) {
    const action = button.dataset.action;
    if (action === "open-collection") return openCollection(button.dataset.id);
    if (action === "open-asset") return openAsset(button.dataset.id);
    if (action === "open-collectible") return openCollectible(button.dataset.id);
    if (action === "open-owned-asset") {
      const item = state.inventory.find((x) => x.id === button.dataset.id);
      if (item) {
        state.currentCollection = item.collection.id;
        return openAsset(item.asset.id, item.id);
      }
    }
    if (action === "open-inventory") return openInventory(button.dataset.id);
    if (action === "buy-listing") {
      button.disabled = true;
      await submitOrder(button.dataset.id, "buy", Number(button.dataset.price), "collectible");
      return openAsset(state.currentAsset, state.currentCollectible);
    }
    if (action === "cancel-order") {
      button.disabled = true;
      await api("cancel_order", { order_id: button.dataset.id });
      await refreshWalletOnly();
      toast("Заявка отменена");
      if (state.view === "asset") return openAsset(state.currentAsset, state.currentCollectible);
      return renderMyOrders();
    }
    if (action === "my-orders") return renderMyOrders();
    if (action === "admin-open") return renderAdminHome();
    if (action === "admin-users") return renderAdminUsers();
    if (action === "admin-catalog") return renderAdminCatalog();
    if (action === "admin-market") return renderAdminMarket();
    if (action === "admin-audit") return renderAdminAudit();
    if (action === "admin-open-user") return openAdminUser(button.dataset.id);
    if (action === "admin-lift-all") {
      await api("admin_lift_restrictions", { user_id: button.dataset.id });
      toast("Ограничения сняты");
      return openAdminUser(button.dataset.id);
    }
    if (action === "catalog-status") {
      const status = button.dataset.status;
      await api("admin_set_catalog_status", {
        target_type: button.dataset.type,
        target_id: button.dataset.id,
        status: status
      });
      toast(status === "published" ? "Опубликовано" : "Снято с публикации");
      return renderAdminCatalog();
    }
    if (action === "toggle-trading") {
      const enabled = button.dataset.enabled === "true";
      await api("admin_update_settings", { trading_enabled: enabled });
      toast(enabled ? "Торги возобновлены" : "Торги приостановлены");
      return renderAdminMarket();
    }
    if (action === "timeframe") {
      state.currentTimeframe = button.dataset.tf;
      screen.querySelectorAll("[data-action='timeframe']").forEach((x) => x.classList.toggle("active", x.dataset.tf === state.currentTimeframe));
      return loadChart(state.currentAsset, state.currentTimeframe);
    }
  }

  async function uploadAdminFile(file, folder) {
    if (!file || !file.size) return null;
    if (file.size > 25 * 1024 * 1024) throw new Error("Файл больше 25 МБ");
    const allowed = [
      "image/png","image/jpeg","image/webp","image/gif","image/avif",
      "video/mp4","video/webm","video/quicktime",
      "model/gltf-binary","model/gltf+json","application/octet-stream"
    ];
    if (file.type && !allowed.includes(file.type)) {
      throw new Error("Формат файла не поддерживается");
    }
    const cleanName = String(file.name || "asset").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
    const path = "models/" + state.user.id + "/" + folder + "/" +
      Date.now() + "-" + crypto.randomUUID() + "-" + cleanName;
    const bucket = state.sb.storage.from("market-assets");
    const result = await bucket.upload(path, file, {
      cacheControl: "31536000",
      upsert: false,
      contentType: file.type || undefined
    });
    if (result.error) throw result.error;
    const publicUrl = bucket.getPublicUrl(path).data.publicUrl;
    return { path: path, url: publicUrl, size: file.size };
  }

  async function handleSubmit(form) {
    const data = new FormData(form);
    const value = (name) => String(data.get(name) || "").trim();
    const formType = form.dataset.form;
    if (formType === "asset-bid" || formType === "sell") {
      const price = Number(value("price"));
      if (!Number.isSafeInteger(price) || price <= 0) throw new Error("Введите корректную цену");
      await submitOrder(
        form.dataset.id,
        formType === "asset-bid" ? "buy" : "sell",
        price,
        formType === "asset-bid" ? "asset" : "collectible"
      );
      return openAsset(state.currentAsset, state.currentCollectible);
    }
    if (formType === "admin-search") return searchAdminUsers(value("search"));
    if (formType === "balance-adjust") {
      const amount = Number(value("amount"));
      if (!Number.isSafeInteger(amount) || amount === 0) throw new Error("Сумма должна быть целым числом, не равным нулю");
      await api("admin_adjust_balance", { user_id: state.adminSelectedUser, amount: amount, reason: value("reason") });
      toast(amount > 0 ? "Баланс начислен" : "Баланс списан");
      return openAdminUser(state.adminSelectedUser);
    }
    if (formType === "restriction") {
      const duration = value("duration") === "null" ? null : Number(value("duration"));
      await api("admin_set_restriction", {
        user_id: state.adminSelectedUser,
        restriction_type: value("type"),
        duration_minutes: duration,
        reason: value("reason")
      });
      toast("Ограничение установлено");
      return openAdminUser(state.adminSelectedUser);
    }
    if (formType === "create-collection") {
      await api("admin_create_collection", {
        name: value("name"),
        slug: slugify(value("name")),
        description: value("description") || null,
        cover_url: value("cover_url") || null,
        status: value("status")
      });
      toast("Коллекция создана");
      return renderAdminCatalog();
    }
    if (formType === "create-gift") {
      await api("admin_create_gift_type", {
        collection_id: value("collection_id"),
        name: value("name"),
        slug: slugify(value("name")),
        description: value("description") || null,
        cover_url: value("cover_url") || null,
        status: value("status")
      });
      toast("Модель подарка добавлена");
      return renderAdminCatalog();
    }
    if (formType === "mint-asset") {
      const quantity = Number(value("quantity"));
      if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000) {
        throw new Error("Количество должно быть от 1 до 1000");
      }
      const result = await api("admin_mint_collectibles", {
        asset_id: form.dataset.id,
        quantity: quantity
      });
      toast("Выпущено экземпляров: " + fmt(result && result.minted));
      return renderAdminCatalog();
    }
    if (formType === "admin-commission") {
      const percent = Number(value("commission"));
      if (!Number.isFinite(percent) || percent < 0 || percent > 10) {
        throw new Error("Комиссия должна быть от 0 до 10%");
      }
      await api("admin_update_settings", { commission_bps: Math.round(percent * 100) });
      toast("Комиссия сохранена");
      return renderAdminMarket();
    }
    if (formType === "create-variant") {
      const imageFile = data.get("image_file");
      const modelFile = data.get("model_file");
      let imageUrl = value("image_url") || null;
      let modelUrl = value("model_url") || null;
      let modelSizeBytes = null;
      const uploadedPaths = [];
      try {
        if (imageFile instanceof File && imageFile.size > 0) {
          const uploaded = await uploadAdminFile(imageFile, "media");
          imageUrl = uploaded.url;
          uploadedPaths.push(uploaded.path);
        }
        if (modelFile instanceof File && modelFile.size > 0) {
          const uploaded = await uploadAdminFile(modelFile, "models");
          modelUrl = uploaded.url;
          modelSizeBytes = uploaded.size;
          uploadedPaths.push(uploaded.path);
        }
      } catch (error) {
        if (uploadedPaths.length) await state.sb.storage.from("market-assets").remove(uploadedPaths);
        throw error;
      }
      const maxSupply = Number(value("max_supply"));
      const mintQuantity = Number(value("mint_quantity"));
      const price = Number(value("initial_price"));
      if (!Number.isSafeInteger(maxSupply) || maxSupply < 1 ||
          !Number.isSafeInteger(mintQuantity) || mintQuantity < 0 ||
          mintQuantity > maxSupply || !Number.isSafeInteger(price) || price < 0) {
        throw new Error("Проверьте цену и тираж");
      }
      await api("admin_create_variant", {
        gift_type_id: value("gift_type_id"),
        name: value("name"),
        rarity: value("rarity"),
        model_name: value("model_name") || value("name"),
        background: value("background") || null,
        pattern: value("pattern") || null,
        description: null,
        image_url: imageUrl,
        model_url: modelUrl,
        model_size_bytes: modelSizeBytes,
        initial_price: price,
        max_supply: maxSupply,
        mint_quantity: mintQuantity,
        status: value("status")
      });
      toast("NFT-модель создана");
      return renderAdminCatalog();
    }
  }

  function slugify(text) {
    return String(text || "").toLowerCase().trim()
      .replace(/[\s_]+/g, "-")
      .replace(/[^a-z0-9а-яё-]/gi, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 70) || ("gift-" + Date.now());
  }

  function goBack() {
    if (typeof state.back === "function") {
      const action = state.back;
      state.back = null;
      Promise.resolve(action()).catch(showError);
    } else {
      setTab(state.tab);
    }
  }
  function showError(error) {
    console.error(error);
    toast(getErrorMessage(error));
  }

  bottomNav.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tab]");
    if (!button) return;
    setTab(button.dataset.tab).catch(showError);
  });
  backButton.addEventListener("click", goBack);
  document.getElementById("currency-toggle").addEventListener("click", async () => {
    try {
      const next = state.displayCurrency === "RUB" ? "USD" : "RUB";
      if (next === "USD" && (!state.fxRate || state.fxRate <= 0)) {
        const fx = await api("get_fx_rate");
        state.fxRate = Number(fx && fx.rub_per_usd) || null;
      }
      if (next === "USD" && (!state.fxRate || state.fxRate <= 0)) {
        throw new Error("Курс доллара сейчас недоступен");
      }
      const result = await state.sb.from("market_user_preferences")
        .update({ display_currency: next }).eq("user_id", state.user.id);
      if (result.error) throw result.error;
      state.displayCurrency = next;
      state.preferences.display_currency = next;
      setBalance();
    } catch (error) {
      showError(error);
    }
  });
  screen.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    Promise.resolve(handleClick(button)).catch(showError);
  });
  screen.addEventListener("submit", (event) => {
    const form = event.target.closest("form[data-form]");
    if (!form) return;
    event.preventDefault();
    Promise.resolve(handleSubmit(form)).catch(showError);
  });
  screen.addEventListener("change", async (event) => {
    const filter = event.target.closest("[data-filter]");
    if (filter) {
      state.collectionFilter[filter.dataset.filter] = filter.value;
      renderCollectionGrid();
      return;
    }
    const input = event.target.closest("[data-setting]");
    if (!input) return;
    try {
      const key = input.dataset.setting;
      const value = key === "theme" ? (input.checked ? "dark" : "light") : input.checked;
      const patch = {};
      patch[key] = value;
      const result = await state.sb.from("market_user_preferences").update(patch).eq("user_id", state.user.id);
      if (result.error) throw result.error;
      state.preferences[key] = value;
      if (key === "theme") setTheme(value);
      toast("Настройки сохранены");
    } catch (error) {
      showError(error);
    }
  });

  window.addEventListener("error", (event) => {
    if (event && event.error) console.error(event.error);
  });

  authenticate().catch((error) => {
    console.error(error);
    setHeader("Не удалось войти", "Проверьте подключение", false);
    bottomNav.hidden = true;
    screen.innerHTML = empty("⚠", "Ошибка запуска", getErrorMessage(error) +
      ". Убедитесь, что Telegram-бот настроен и секрет TELEGRAM_BOT_TOKEN добавлен в Supabase.");
  });
})();