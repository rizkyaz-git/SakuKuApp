/**
 * SakuKu Offline-First Storage, Cloud Sync, Monet Dynamic Color,
 * Real-Time Semi-Online Exchange Rates & Auto-Formatting Currency Engine
 */

const STORAGE_KEY = 'sakuku_state_v1';

const DEFAULT_RATES = {
  IDR: 1,
  USD: 16200,
  SAR: 4320,
  updatedAt: '',
  source: 'default'
};

function uid(prefix) {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function createSampleState() {
  const today = todayIso();
  const ym = today.slice(0, 7);
  const book1Id = 'book_darurat';
  const book2Id = 'book_liburan';
  const now = new Date().toISOString();

  return {
    transactions: [
      {
        id: 'tx_sample_1',
        date: `${ym}-01`,
        type: 'income',
        category: 'Gaji',
        amount: 6500000,
        currency: 'IDR',
        originalAmount: 6500000,
        exchangeRate: 1,
        method: 'Transfer Bank',
        note: 'Gaji bulanan',
        updatedAt: now,
        deleted: false,
        syncStatus: 'pending'
      },
      {
        id: 'tx_sample_2',
        date: `${ym}-03`,
        type: 'expense',
        category: 'Makan & Minum',
        amount: 45000,
        currency: 'IDR',
        originalAmount: 45000,
        exchangeRate: 1,
        method: 'QRIS',
        note: 'Makan siang & kopi',
        updatedAt: now,
        deleted: false,
        syncStatus: 'pending'
      },
      {
        id: 'tx_sample_3',
        date: `${ym}-05`,
        type: 'expense',
        category: 'Tagihan',
        amount: 450000,
        currency: 'IDR',
        originalAmount: 450000,
        exchangeRate: 1,
        method: 'Transfer Bank',
        note: 'Listrik & internet bulanan',
        updatedAt: now,
        deleted: false,
        syncStatus: 'pending'
      },
      {
        id: 'tx_sample_4',
        date: today,
        type: 'expense',
        category: 'Transportasi',
        amount: 35000,
        currency: 'IDR',
        originalAmount: 35000,
        exchangeRate: 1,
        method: 'E-Wallet',
        note: 'Ojek online & bensin',
        updatedAt: now,
        deleted: false,
        syncStatus: 'pending'
      }
    ],
    savingsBooks: [
      {
        id: book1Id,
        name: 'Dana Darurat',
        target: 15000000,
        balance: 4500000,
        color: '#006A60',
        note: 'Target 6x pengeluaran bulanan',
        updatedAt: now,
        deleted: false,
        syncStatus: 'pending'
      },
      {
        id: book2Id,
        name: 'Tabungan Liburan',
        target: 5000000,
        balance: 1250000,
        color: '#006399',
        note: 'Rencana akhir tahun',
        updatedAt: now,
        deleted: false,
        syncStatus: 'pending'
      }
    ],
    savingsLedger: [
      {
        id: 'ldg_sample_1',
        bookId: book1Id,
        date: `${ym}-01`,
        type: 'deposit',
        amount: 3500000,
        balanceAfter: 3500000,
        note: 'Saldo awal buku tabungan',
        updatedAt: now,
        deleted: false,
        syncStatus: 'pending'
      },
      {
        id: 'ldg_sample_2',
        bookId: book1Id,
        date: `${ym}-02`,
        type: 'deposit',
        amount: 1000000,
        balanceAfter: 4500000,
        note: 'Sisihkan dari gaji',
        updatedAt: now,
        deleted: false,
        syncStatus: 'pending'
      },
      {
        id: 'ldg_sample_3',
        bookId: book2Id,
        date: `${ym}-02`,
        type: 'deposit',
        amount: 1250000,
        balanceAfter: 1250000,
        note: 'Setoran awal liburan',
        updatedAt: now,
        deleted: false,
        syncStatus: 'pending'
      }
    ],
    wishlist: [
      {
        id: 'wish_sample_1',
        name: 'Earphone Wireless ANC',
        price: 850000,
        priority: 'medium',
        category: 'Belanja',
        status: 'pending',
        note: 'Untuk fokus kerja & perjalanan',
        updatedAt: now,
        deleted: false,
        syncStatus: 'pending'
      },
      {
        id: 'wish_sample_2',
        name: 'Sepatu Lari Harian',
        price: 1200000,
        priority: 'high',
        category: 'Kesehatan',
        status: 'pending',
        note: 'Tunggu promo tanggal kembar',
        updatedAt: now,
        deleted: false,
        syncStatus: 'pending'
      }
    ],
    settings: {
      gasUrl: '',
      themeMode: 'system', // 'system' | 'light' | 'dark'
      displayCurrency: 'IDR', // 'IDR' | 'USD' | 'SAR'
      exchangeRates: Object.assign({}, DEFAULT_RATES),
      reportOwner: '',
      lastSyncAt: ''
    }
  };
}

/* ==========================================================================
   Currency Formatting & Live Auto-Format Input Engine
   ========================================================================== */
const CurrencyFormat = {
  getRates() {
    const r = (Store.state && Store.state.settings && Store.state.settings.exchangeRates) || DEFAULT_RATES;
    return {
      IDR: 1,
      USD: Number(r.USD) > 0 ? Number(r.USD) : DEFAULT_RATES.USD,
      SAR: Number(r.SAR) > 0 ? Number(r.SAR) : DEFAULT_RATES.SAR,
      updatedAt: r.updatedAt || '',
      source: r.source || 'default'
    };
  },

  getDisplayCurrency() {
    return (Store.state && Store.state.settings && Store.state.settings.displayCurrency) || 'IDR';
  },

  convertToIdr(amount, currency) {
    const val = Number(amount) || 0;
    const cur = (currency || 'IDR').toUpperCase();
    if (cur === 'IDR') return Math.round(val);
    const rates = this.getRates();
    const rate = rates[cur] || 1;
    return Math.round(val * rate);
  },

  convertFromIdr(amountIdr, targetCurrency) {
    const val = Number(amountIdr) || 0;
    const cur = (targetCurrency || 'IDR').toUpperCase();
    if (cur === 'IDR') return val;
    const rates = this.getRates();
    const rate = rates[cur] || 1;
    return val / rate;
  },

  getSymbol(currency) {
    const cur = (currency || 'IDR').toUpperCase();
    if (cur === 'USD') return '$';
    if (cur === 'SAR') return 'SAR';
    return 'Rp';
  },

  formatOriginal(amount, currency) {
    const cur = (currency || 'IDR').toUpperCase();
    const num = Number(amount) || 0;
    const isNeg = num < 0;
    const abs = Math.abs(num);
    const sign = isNeg ? '−' : '';

    if (cur === 'USD') {
      return `${sign}$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (cur === 'SAR') {
      return `${sign}SAR ${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `${sign}Rp ${Math.round(abs).toLocaleString('id-ID')}`;
  },

  formatMoney(amountIdr, overrideCurrency) {
    const cur = (overrideCurrency || this.getDisplayCurrency()).toUpperCase();
    const converted = this.convertFromIdr(amountIdr, cur);
    return this.formatOriginal(converted, cur);
  },

  formatShortMoney(amountIdr, overrideCurrency) {
    const cur = (overrideCurrency || this.getDisplayCurrency()).toUpperCase();
    const val = this.convertFromIdr(amountIdr, cur);
    const abs = Math.abs(val);
    const sign = val < 0 ? '-' : '';

    if (cur === 'IDR') {
      if (abs >= 1e9) return sign + (abs / 1e9).toFixed(1).replace(/\.0$/, '').replace('.', ',') + 'M';
      if (abs >= 1e6) return sign + (abs / 1e6).toFixed(1).replace(/\.0$/, '').replace('.', ',') + 'jt';
      if (abs >= 1e3) return sign + Math.round(abs / 1e3) + 'rb';
      return sign + Math.round(abs);
    }

    const prefix = cur === 'USD' ? '$' : 'SAR ';
    if (abs >= 1e6) return sign + prefix + (abs / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (abs >= 1e3) return sign + prefix + (abs / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return sign + prefix + abs.toFixed(abs < 100 && abs > 0 ? 1 : 0).replace(/\.0$/, '');
  },

  /**
   * Format angka mentah ke string input dengan pemisah ribuan otomatis
   * IDR: 1.500.000 (tanpa desimal)
   * USD/SAR: 1,500.50 (maks 2 desimal)
   */
  formatForInput(raw, currency) {
    const cur = (currency || 'IDR').toUpperCase();
    const str = String(raw == null ? '' : raw);
    if (!str) return '';

    if (cur === 'IDR') {
      const digits = str.replace(/\D/g, '');
      if (!digits) return '';
      const clean = digits.replace(/^0+(?=\d)/, '');
      return clean.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    // USD / SAR: izinkan desimal dengan titik (koma dikonversi otomatis ke titik)
    let cleaned = str.replace(/,/g, '.').replace(/[^\d.]/g, '');
    const parts = cleaned.split('.');
    let intPart = parts[0].replace(/^0+(?=\d)/, '');
    if (intPart === '' && parts.length > 1) intPart = '0';
    intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    if (parts.length > 1) {
      const decPart = parts.slice(1).join('').slice(0, 2);
      return `${intPart}.${decPart}`;
    }
    return intPart;
  },

  parseInput(formattedStr, currency) {
    const cur = (currency || 'IDR').toUpperCase();
    const str = String(formattedStr || '').trim();
    if (!str) return 0;

    if (cur === 'IDR') {
      const digits = str.replace(/\D/g, '');
      return digits ? parseInt(digits, 10) : 0;
    }

    const normalized = str.replace(/,/g, '').replace(/[^\d.]/g, '');
    const num = parseFloat(normalized);
    return isNaN(num) ? 0 : num;
  },

  attachInput(inputEl, getCurrencyFn, onChangeFn) {
    if (!inputEl) return;
    const curFn = typeof getCurrencyFn === 'function' ? getCurrencyFn : () => getCurrencyFn || 'IDR';

    const syncFormat = () => {
      const cur = curFn();
      const oldVal = inputEl.value;
      const oldSel = inputEl.selectionStart || 0;

      // Hitung jumlah karakter bermakna (digit + titik desimal untuk FX) sebelum kursor
      const beforeCursor = oldVal.slice(0, oldSel);
      const meaningfulBefore = (cur === 'IDR')
        ? beforeCursor.replace(/\D/g, '').length
        : beforeCursor.replace(/[^\d.]/g, '').length;

      const formatted = this.formatForInput(oldVal, cur);
      inputEl.value = formatted;

      // Kembalikan posisi kursor secara akurat
      let newPos = 0;
      let seen = 0;
      for (let i = 0; i < formatted.length; i++) {
        const ch = formatted[i];
        const isMeaningful = (cur === 'IDR') ? /\d/.test(ch) : /[\d.]/.test(ch);
        if (seen >= meaningfulBefore) break;
        if (isMeaningful) seen++;
        newPos = i + 1;
      }
      try {
        inputEl.setSelectionRange(newPos, newPos);
      } catch (e) {}

      if (onChangeFn) onChangeFn(this.parseInput(formatted, cur), cur);
    };

    inputEl.addEventListener('input', syncFormat);
    inputEl.addEventListener('blur', () => {
      const cur = curFn();
      const val = this.parseInput(inputEl.value, cur);
      if (val > 0 && cur !== 'IDR') {
        inputEl.value = val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
      }
    });
  }
};

// Alias global untuk kompatibilitas backward dengan charts.js
function formatRpFull(val) {
  return CurrencyFormat.formatMoney(val);
}

function formatRpShort(val) {
  return CurrencyFormat.formatShortMoney(val);
}

/* ==========================================================================
   Real-Time Semi-Online Exchange Rate Engine (IDR <-> USD / SAR)
   ========================================================================== */
const ExchangeService = {
  isFetching: false,

  async fetchLiveRates(force = false) {
    if (this.isFetching) return { ok: false, reason: 'busy' };
    if (!navigator.onLine) return { ok: false, reason: 'offline' };

    const current = CurrencyFormat.getRates();
    const sixHoursMs = 6 * 60 * 60 * 1000;
    if (!force && current.updatedAt && current.source === 'live') {
      const age = Date.now() - new Date(current.updatedAt).getTime();
      if (age >= 0 && age < sixHoursMs) {
        return { ok: true, cached: true, rates: current };
      }
    }

    this.isFetching = true;
    try {
      let usdToIdr = 0;
      let sarToIdr = 0;

      // 1. Jika mode GAS Embedded, coba ambil lewat server GAS (UrlFetchApp + CacheService)
      if (Store.isGasEmbedded()) {
        try {
          const gasRes = await new Promise((resolve, reject) => {
            google.script.run
              .withSuccessHandler(resolve)
              .withFailureHandler(reject)
              .getExchangeRates();
          });
          if (gasRes && gasRes.ok && gasRes.USD > 0 && gasRes.SAR > 0) {
            usdToIdr = gasRes.USD;
            sarToIdr = gasRes.SAR;
          }
        } catch (e) {}
      }

      // 2. Primary Real-Time API (CORS-friendly, tanpa API key)
      if (!usdToIdr || !sarToIdr) {
        try {
          const res = await fetch('https://open.er-api.com/v6/latest/IDR', { cache: 'no-store' });
          if (res.ok) {
            const json = await res.json();
            if (json && json.rates && json.rates.USD && json.rates.SAR) {
              usdToIdr = Math.round(1 / json.rates.USD);
              sarToIdr = Math.round(1 / json.rates.SAR);
            }
          }
        } catch (e) {}
      }

      // 3. Fallback Real-Time CDN API
      if (!usdToIdr || !sarToIdr) {
        const res2 = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/idr.json', { cache: 'no-store' });
        if (res2.ok) {
          const json2 = await res2.json();
          if (json2 && json2.idr && json2.idr.usd && json2.idr.sar) {
            usdToIdr = Math.round(1 / json2.idr.usd);
            sarToIdr = Math.round(1 / json2.idr.sar);
          }
        }
      }

      if (usdToIdr > 0 && sarToIdr > 0) {
        Store.state.settings.exchangeRates = {
          IDR: 1,
          USD: usdToIdr,
          SAR: sarToIdr,
          updatedAt: new Date().toISOString(),
          source: 'live'
        };
        Store.save();
        this.isFetching = false;
        return { ok: true, rates: Store.state.settings.exchangeRates };
      }

      throw new Error('Data kurs tidak valid');
    } catch (err) {
      this.isFetching = false;
      return { ok: false, error: err.message || 'Gagal memperbarui kurs' };
    }
  }
};

/* ==========================================================================
   Material 3 Dynamic Monet Color Engine (Otomatis Mengikuti Tema Perangkat)
   ========================================================================== */
const MonetEngine = {
  probeDeviceHue() {
    try {
      const probe = document.createElement('span');
      probe.style.color = 'AccentColor';
      probe.style.position = 'fixed';
      probe.style.visibility = 'hidden';
      probe.style.pointerEvents = 'none';
      document.body.appendChild(probe);
      const computed = getComputedStyle(probe).color;
      document.body.removeChild(probe);

      const m = computed && computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (m) {
        const r = Number(m[1]) / 255;
        const g = Number(m[2]) / 255;
        const b = Number(m[3]) / 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;
        const s = max === 0 ? 0 : d / max;

        // Gunakan warna aksen sistem jika cukup kromatik (bukan abu-abu/hitam/putih)
        if (s > 0.14 && max > 0.15 && min < 0.92) {
          let h = 0;
          if (d !== 0) {
            if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
            else if (max === g) h = ((b - r) / d + 2) * 60;
            else h = ((r - g) / d + 4) * 60;
          }
          return { hue: Math.round(h) % 360, sat: Math.min(72, Math.max(42, Math.round(s * 78))), source: 'device' };
        }
      }
    } catch (e) {}

    // Default M3 Expressive Seed (Teal) jika browser tidak mengekspos AccentColor
    return { hue: 174, sat: 64, source: 'default' };
  },

  hsl(h, s, l) {
    return `hsl(${((h % 360) + 360) % 360}, ${s}%, ${l}%)`;
  },

  hslToHex(h, s, l) {
    const hue = ((h % 360) + 360) % 360;
    const sat = s / 100;
    const lig = l / 100;
    const a = sat * Math.min(lig, 1 - lig);
    const f = (n) => {
      const k = (n + hue / 30) % 12;
      const color = lig - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  },

  isDarkMode(themeMode) {
    if (themeMode === 'dark') return true;
    if (themeMode === 'light') return false;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  },

  apply(themeMode = 'system') {
    const isDark = this.isDarkMode(themeMode);
    const { hue, sat, source } = this.probeDeviceHue();
    const h2 = (hue + 14) % 360; // Secondary harmonis
    const h3 = (hue + 56) % 360; // Tertiary ekspresif

    const root = document.documentElement;
    root.setAttribute('data-theme', isDark ? 'dark' : 'light');

    const tokens = isDark ? {
      '--md-sys-color-primary': this.hsl(hue, Math.min(78, sat + 10), 74),
      '--md-sys-color-on-primary': this.hsl(hue, sat, 14),
      '--md-sys-color-primary-container': this.hsl(hue, Math.max(36, sat - 6), 26),
      '--md-sys-color-on-primary-container': this.hsl(hue, 80, 90),

      '--md-sys-color-secondary': this.hsl(h2, 26, 76),
      '--md-sys-color-on-secondary': this.hsl(h2, 28, 16),
      '--md-sys-color-secondary-container': this.hsl(h2, 24, 26),
      '--md-sys-color-on-secondary-container': this.hsl(h2, 46, 90),

      '--md-sys-color-tertiary': this.hsl(h3, 52, 78),
      '--md-sys-color-on-tertiary': this.hsl(h3, 46, 16),
      '--md-sys-color-tertiary-container': this.hsl(h3, 38, 28),
      '--md-sys-color-on-tertiary-container': this.hsl(h3, 72, 92),

      '--md-sys-color-background': this.hsl(hue, 12, 7),
      '--md-sys-color-surface': this.hsl(hue, 12, 7),
      '--md-sys-color-surface-dim': this.hsl(hue, 12, 6),
      '--md-sys-color-surface-container-lowest': this.hsl(hue, 14, 5),
      '--md-sys-color-surface-container-low': this.hsl(hue, 12, 11),
      '--md-sys-color-surface-container': this.hsl(hue, 12, 14),
      '--md-sys-color-surface-container-high': this.hsl(hue, 12, 18),
      '--md-sys-color-surface-container-highest': this.hsl(hue, 12, 22),

      '--md-sys-color-on-surface': this.hsl(hue, 12, 92),
      '--md-sys-color-on-surface-variant': this.hsl(hue, 10, 74),
      '--md-sys-color-outline': this.hsl(hue, 8, 56),
      '--md-sys-color-outline-variant': this.hsl(hue, 10, 26),
      '--md-sys-color-inverse-surface': this.hsl(hue, 14, 90),
      '--md-sys-color-inverse-on-surface': this.hsl(hue, 12, 16)
    } : {
      '--md-sys-color-primary': this.hsl(hue, sat, 32),
      '--md-sys-color-on-primary': '#FFFFFF',
      '--md-sys-color-primary-container': this.hsl(hue, Math.min(82, sat + 12), 86),
      '--md-sys-color-on-primary-container': this.hsl(hue, sat, 11),

      '--md-sys-color-secondary': this.hsl(h2, 24, 38),
      '--md-sys-color-on-secondary': '#FFFFFF',
      '--md-sys-color-secondary-container': this.hsl(h2, 34, 88),
      '--md-sys-color-on-secondary-container': this.hsl(h2, 32, 14),

      '--md-sys-color-tertiary': this.hsl(h3, 44, 36),
      '--md-sys-color-on-tertiary': '#FFFFFF',
      '--md-sys-color-tertiary-container': this.hsl(h3, 64, 89),
      '--md-sys-color-on-tertiary-container': this.hsl(h3, 52, 13),

      '--md-sys-color-background': this.hsl(hue, 22, 97),
      '--md-sys-color-surface': this.hsl(hue, 22, 97),
      '--md-sys-color-surface-dim': this.hsl(hue, 14, 86),
      '--md-sys-color-surface-container-lowest': '#FFFFFF',
      '--md-sys-color-surface-container-low': this.hsl(hue, 20, 94),
      '--md-sys-color-surface-container': this.hsl(hue, 18, 91),
      '--md-sys-color-surface-container-high': this.hsl(hue, 16, 88),
      '--md-sys-color-surface-container-highest': this.hsl(hue, 15, 85),

      '--md-sys-color-on-surface': this.hsl(hue, 16, 11),
      '--md-sys-color-on-surface-variant': this.hsl(hue, 12, 30),
      '--md-sys-color-outline': this.hsl(hue, 8, 46),
      '--md-sys-color-outline-variant': this.hsl(hue, 12, 80),
      '--md-sys-color-inverse-surface': this.hsl(hue, 14, 18),
      '--md-sys-color-inverse-on-surface': this.hsl(hue, 18, 94)
    };

    Object.keys(tokens).forEach((k) => root.style.setProperty(k, tokens[k]));

    // Sinkronkan warna status bar perangkat (edge-to-edge) dengan surface aktif
    const surfaceHex = isDark
      ? this.hslToHex(hue, 12, 7)
      : this.hslToHex(hue, 22, 97);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', surfaceHex);

    return { isDark, hue, source };
  }
};

/* ==========================================================================
   Offline-First Store & Cloud Sync Engine
   ========================================================================== */
const Store = {
  state: null,
  isSyncing: false,
  listeners: [],

  init() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const savedSettings = parsed.settings || {};
        this.state = {
          transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
          savingsBooks: Array.isArray(parsed.savingsBooks) ? parsed.savingsBooks : [],
          savingsLedger: Array.isArray(parsed.savingsLedger) ? parsed.savingsLedger : [],
          wishlist: Array.isArray(parsed.wishlist) ? parsed.wishlist : [],
          settings: Object.assign(
            {
              gasUrl: '',
              themeMode: 'system',
              displayCurrency: 'IDR',
              exchangeRates: Object.assign({}, DEFAULT_RATES),
              reportOwner: '',
              lastSyncAt: ''
            },
            savedSettings,
            {
              exchangeRates: Object.assign({}, DEFAULT_RATES, savedSettings.exchangeRates || {})
            }
          )
        };
      } else {
        this.state = createSampleState();
        this.save();
      }
    } catch (e) {
      this.state = createSampleState();
      this.save();
    }
    return this.state;
  },

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error('Gagal menyimpan ke localStorage:', e);
    }
    this.notify();
  },

  subscribe(fn) {
    this.listeners.push(fn);
  },

  notify() {
    this.listeners.forEach((fn) => fn(this.state));
  },

  getPendingCount() {
    const s = this.state;
    const countPending = (arr) => arr.filter((x) => x.syncStatus === 'pending').length;
    return (
      countPending(s.transactions) +
      countPending(s.savingsBooks) +
      countPending(s.savingsLedger) +
      countPending(s.wishlist)
    );
  },

  isGasEmbedded() {
    return typeof google !== 'undefined' && google.script && google.script.run;
  },

  canSync() {
    return navigator.onLine && (this.isGasEmbedded() || Boolean(this.state.settings.gasUrl));
  },

  async syncNow(silent = false) {
    if (this.isSyncing) return { ok: false, reason: 'busy' };
    if (!navigator.onLine) return { ok: false, reason: 'offline' };
    if (!this.isGasEmbedded() && !this.state.settings.gasUrl) {
      return { ok: false, reason: 'no_url' };
    }

    this.isSyncing = true;
    this.notify();

    const payload = {
      transactions: this.state.transactions.filter((x) => x.syncStatus === 'pending'),
      savingsBooks: this.state.savingsBooks.filter((x) => x.syncStatus === 'pending'),
      savingsLedger: this.state.savingsLedger.filter((x) => x.syncStatus === 'pending'),
      wishlist: this.state.wishlist.filter((x) => x.syncStatus === 'pending')
    };

    try {
      let result;
      if (this.isGasEmbedded()) {
        result = await new Promise((resolve, reject) => {
          google.script.run
            .withSuccessHandler(resolve)
            .withFailureHandler(reject)
            .syncFromClient(payload);
        });
      } else {
        const res = await fetch(this.state.settings.gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
        result = await res.json();
      }

      if (!result || !result.ok) {
        throw new Error((result && result.error) || 'Respons server tidak valid');
      }

      this.mergeServerData(result.data);
      this.state.settings.lastSyncAt = result.serverTime || new Date().toISOString();
      this.save();

      this.isSyncing = false;
      this.notify();
      return { ok: true };
    } catch (err) {
      this.isSyncing = false;
      this.notify();
      if (!silent) console.error('Sync gagal:', err);
      return { ok: false, error: err.message || 'Gagal terhubung ke Google Sheets' };
    }
  },

  mergeServerData(serverData) {
    if (!serverData) return;

    const mergeList = (localArr, remoteArr) => {
      const map = new Map();
      localArr.forEach((item) => {
        map.set(item.id, Object.assign({}, item, { syncStatus: 'synced' }));
      });
      (remoteArr || []).forEach((rItem) => {
        const existing = map.get(rItem.id);
        if (!existing || String(rItem.updatedAt || '') >= String(existing.updatedAt || '')) {
          map.set(rItem.id, Object.assign({}, rItem, { syncStatus: 'synced' }));
        }
      });
      return Array.from(map.values());
    };

    this.state.transactions = mergeList(this.state.transactions, serverData.transactions);
    this.state.savingsBooks = mergeList(this.state.savingsBooks, serverData.savingsBooks);
    this.state.savingsLedger = mergeList(this.state.savingsLedger, serverData.savingsLedger);
    this.state.wishlist = mergeList(this.state.wishlist, serverData.wishlist);
  }
};
