/**
 * SakuKu — Aplikasi Mobile Pencatatan Keuangan Harian
 * Material 3 Expressive + Monet Otomatis + Multi-Mata Uang (IDR/USD/SAR)
 * + Kalender Analitik + Date Picker + Swipe Navigasi + Laporan PDF Semi-Formal
 */

const EXPENSE_CATEGORIES = [
  { name: 'Makan & Minum', icon: '🍽️' },
  { name: 'Transportasi', icon: '🛵' },
  { name: 'Belanja', icon: '🛍️' },
  { name: 'Tagihan', icon: '⚡' },
  { name: 'Kesehatan', icon: '🩺' },
  { name: 'Hiburan', icon: '🎬' },
  { name: 'Pendidikan', icon: '📚' },
  { name: 'Tabungan', icon: '🏦' },
  { name: 'Lainnya', icon: '📦' }
];

const INCOME_CATEGORIES = [
  { name: 'Gaji', icon: '💼' },
  { name: 'Bonus', icon: '🎁' },
  { name: 'Usaha', icon: '🏪' },
  { name: 'Investasi', icon: '📈' },
  { name: 'Hadiah', icon: '🎉' },
  { name: 'Lainnya', icon: '💰' }
];

const PAYMENT_METHODS = ['Tunai', 'QRIS', 'Transfer Bank', 'E-Wallet', 'Kartu Debit/Kredit'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTH_FULL = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];
const WEEKDAYS_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const TAB_ORDER = ['home', 'transactions', 'analytics', 'savings', 'wishlist'];
const CURRENCY_CYCLE = ['IDR', 'USD', 'SAR'];

const App = {
  currentTab: 'home',
  selectedYear: new Date().getFullYear(),
  selectedMonth: new Date().getMonth(), // 0-11
  selectedAnalyticsDate: todayIso(),
  txFilterType: 'all',
  txSearch: '',
  wishFilter: 'pending',
  activeBookId: null,
  autoSyncTimer: null,
  isBooting: true,
  monetInfo: null,

  init() {
    Store.init();
    this.applyTheme();
    this.setupSystemThemeListener();
    this.setupRippleEngine();
    this.setupSwipeNavigation();
    this.setupScrollElevation();
    this.bindEvents();
    Store.subscribe((state, meta) => {
      if (this.isBooting) return;
      if (meta && meta.type === 'sync-status') {
        this.updateSyncPill();
        this.refreshSettingsModalInPlace();
        return;
      }
      if (meta && meta.type === 'sync-complete') {
        this.updateSyncPill();
        this.refreshSettingsModalInPlace();
        if (meta.hasDataChanges) {
          this.render({ silent: true });
        }
        return;
      }
      if (meta && meta.type === 'rates-updated') {
        this.refreshSettingsModalInPlace();
        if (CurrencyFormat.getDisplayCurrency() !== 'IDR') {
          this.render({ silent: true });
        }
        return;
      }
      this.render();
    });

    // Tampilkan Skeleton Screen singkat saat inisialisasi agar transisi terasa hidup
    this.renderSkeletonHome();
    setTimeout(() => {
      this.isBooting = false;
      this.render();
    }, 260);

    // Ambil kurs real-time di latar belakang (semi-online)
    ExchangeService.fetchLiveRates(false);

    // Auto-sync & refresh kurs saat kembali online
    window.addEventListener('online', () => {
      this.updateSyncPill();
      this.refreshSettingsModalInPlace();
      ExchangeService.fetchLiveRates(false);
      if (Store.canSync()) {
        this.showToast('Kembali online — menyinkronkan ke cloud...');
        Store.syncNow(true).then((r) => {
          if (r.ok) this.showToast('Data tersinkronisasi ke Google Sheets');
        });
      }
    });

    window.addEventListener('offline', () => {
      this.updateSyncPill();
      this.refreshSettingsModalInPlace();
      this.showToast('Mode Offline — data tersimpan aman di perangkat');
    });

    // Sinkronisasi awal di latar belakang jika sudah terkonfigurasi
    if (Store.canSync()) {
      Store.syncNow(true);
    }

    // Daftarkan Service Worker untuk mode offline penuh (PWA)
    if ('serviceWorker' in navigator && !Store.isGasEmbedded()) {
      navigator.serviceWorker.register('./sw.js').catch(() => { });
    }
  },

  haptic(ms = 10) {
    try {
      if (navigator.vibrate) navigator.vibrate(ms);
    } catch (e) { }
  },

  applyTheme() {
    const mode = (Store.state && Store.state.settings && Store.state.settings.themeMode) || 'system';
    this.monetInfo = MonetEngine.apply(mode);
  },

  setupSystemThemeListener() {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const mode = (Store.state && Store.state.settings && Store.state.settings.themeMode) || 'system';
      if (mode === 'system') {
        this.applyTheme();
      }
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  },

  setupRippleEngine() {
    document.addEventListener('pointerdown', (e) => {
      const target = e.target.closest('.md-ripple');
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 0.85;
      const wave = document.createElement('span');
      wave.className = 'ripple-wave';
      wave.style.width = `${size}px`;
      wave.style.height = `${size}px`;
      wave.style.left = `${e.clientX - rect.left - size / 2}px`;
      wave.style.top = `${e.clientY - rect.top - size / 2}px`;
      target.appendChild(wave);
      setTimeout(() => wave.remove(), 560);
    }, { passive: true });
  },

  setupScrollElevation() {
    const topBar = document.getElementById('topBar');
    if (!topBar) return;
    window.addEventListener('scroll', () => {
      topBar.classList.toggle('scrolled', window.scrollY > 6);
    }, { passive: true });
  },

  setupSwipeNavigation() {
    const main = document.getElementById('mainContent');
    if (!main) return;
    let startX = 0;
    let startY = 0;
    let isTracking = false;

    main.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      const backdrop = document.getElementById('modalBackdrop');
      if (backdrop && backdrop.classList.contains('open')) return;
      if (e.target.closest('.chip-row, .ledger-table-wrap, input, select, textarea')) return;

      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isTracking = true;
    }, { passive: true });

    main.addEventListener('touchend', (e) => {
      if (!isTracking) return;
      isTracking = false;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      // Aktifkan swipe hanya jika dominan horizontal (> 58px)
      if (Math.abs(dx) > 58 && Math.abs(dx) > Math.abs(dy) * 1.45) {
        const idx = TAB_ORDER.indexOf(this.currentTab);
        if (dx < 0 && idx < TAB_ORDER.length - 1) {
          this.haptic(8);
          this.switchTab(TAB_ORDER[idx + 1], 'right');
        } else if (dx > 0 && idx > 0) {
          this.haptic(8);
          this.switchTab(TAB_ORDER[idx - 1], 'left');
        }
      }
    }, { passive: true });
  },

  renderSkeletonHome() {
    const homeEl = document.getElementById('homeContainer');
    if (!homeEl) return;
    homeEl.innerHTML = `
      <div class="skeleton skel-hero"></div>
      <div class="skel-row-2">
        <div class="skeleton skel-btn"></div>
        <div class="skeleton skel-btn"></div>
      </div>
      <div class="skel-row-2">
        <div class="skeleton skel-stat"></div>
        <div class="skeleton skel-stat"></div>
      </div>
      <div class="skel-list">
        <div class="skeleton skel-tx"></div>
        <div class="skeleton skel-tx"></div>
        <div class="skeleton skel-tx"></div>
      </div>
    `;
  },

  scheduleAutoSync() {
    if (!Store.canSync()) return;
    clearTimeout(this.autoSyncTimer);
    this.autoSyncTimer = setTimeout(() => {
      Store.syncNow(true);
    }, 1800);
  },

  getSelectedYM() {
    return `${this.selectedYear}-${String(this.selectedMonth + 1).padStart(2, '0')}`;
  },

  getActiveTransactions() {
    return Store.state.transactions
      .filter((t) => !t.deleted)
      .sort((a, b) => (b.date + b.updatedAt).localeCompare(a.date + a.updatedAt));
  },

  getMonthTransactions(ym) {
    return this.getActiveTransactions().filter((t) => (t.date || '').startsWith(ym));
  },

  getTotalBalance() {
    return this.getActiveTransactions().reduce((acc, t) => {
      return acc + (t.type === 'income' ? Number(t.amount) : -Number(t.amount));
    }, 0);
  },

  getCategoryIcon(category, type) {
    const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const found = list.find((c) => c.name === category);
    return found ? found.icon : (type === 'income' ? '💰' : '🧾');
  },

  formatDateHuman(isoDate) {
    if (!isoDate) return '-';
    const today = todayIso();
    if (isoDate === today) return 'Hari Ini';
    const d = new Date(isoDate + 'T00:00:00');
    if (isNaN(d.getTime())) return isoDate;
    return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
  },

  setDisplayCurrency(cur) {
    const next = CURRENCY_CYCLE.includes(cur) ? cur : 'IDR';
    Store.state.settings.displayCurrency = next;
    Store.save();
    this.haptic(8);
    if (next === 'IDR') {
      this.showToast('Tampilan utama: Rupiah (IDR)');
    } else {
      const rate = CurrencyFormat.getRates()[next];
      this.showToast(`Pratinjau ${next} aktif (1 ${next} ≈ Rp ${Math.round(rate).toLocaleString('id-ID')})`);
    }
  },

  showToast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  },

  bindEvents() {
    // Bottom navigation
    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const curIdx = TAB_ORDER.indexOf(this.currentTab);
        const nextIdx = TAB_ORDER.indexOf(btn.dataset.tab);
        const dir = nextIdx > curIdx ? 'right' : (nextIdx < curIdx ? 'left' : null);
        this.haptic(6);
        this.switchTab(btn.dataset.tab, dir);
      });
    });

    // Month switcher arrows
    document.getElementById('prevMonthBtn').addEventListener('click', () => {
      this.haptic(6);
      this.selectedMonth -= 1;
      if (this.selectedMonth < 0) {
        this.selectedMonth = 11;
        this.selectedYear -= 1;
      }
      this.selectedAnalyticsDate = '';
      this.render();
    });

    document.getElementById('nextMonthBtn').addEventListener('click', () => {
      this.haptic(6);
      this.selectedMonth += 1;
      if (this.selectedMonth > 11) {
        this.selectedMonth = 0;
        this.selectedYear += 1;
      }
      this.selectedAnalyticsDate = '';
      this.render();
    });

    // Month label -> Popup Date Picker
    document.getElementById('monthLabelBtn').addEventListener('click', () => {
      this.haptic(8);
      this.openDatePickerModal();
    });

    // PDF Export quick button
    document.getElementById('txExportPdfBtn').addEventListener('click', () => this.openPdfExportModal());

    // FAB
    document.getElementById('fabBtn').addEventListener('click', () => {
      this.haptic(10);
      if (this.currentTab === 'savings') {
        this.openBookModal();
      } else if (this.currentTab === 'wishlist') {
        this.openWishlistModal();
      } else {
        this.openTransactionModal(null, 'expense');
      }
    });

    // Sync pill -> Settings modal
    document.getElementById('syncPill').addEventListener('click', () => this.openSettingsModal());

    // Modal backdrop click & Escape key to close
    document.getElementById('modalBackdrop').addEventListener('click', (e) => {
      if (e.target.id === 'modalBackdrop') this.closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeModal();
    });

    // Search transactions
    document.getElementById('txSearchInput').addEventListener('input', (e) => {
      this.txSearch = e.target.value.trim().toLowerCase();
      this.renderTransactionsView();
    });

    // Transaction filter chips
    document.querySelectorAll('#txFilterChips .chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#txFilterChips .chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        this.txFilterType = chip.dataset.filter;
        this.renderTransactionsView();
      });
    });

    // Wishlist filter chips
    document.querySelectorAll('#wishFilterChips .chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#wishFilterChips .chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        this.wishFilter = chip.dataset.filter;
        this.renderWishlistView();
      });
    });
  },

  switchTab(tab, direction = null) {
    if (this.currentTab === tab) return;
    this.currentTab = tab;
    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.view').forEach((v) => {
      v.classList.remove('active', 'slide-from-right', 'slide-from-left');
      if (v.id === 'view-' + tab) {
        v.classList.add('active');
        if (direction === 'right') v.classList.add('slide-from-right');
        else if (direction === 'left') v.classList.add('slide-from-left');
      }
    });
    this.render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  render(options = {}) {
    const main = document.getElementById('mainContent');
    if (main) {
      main.classList.toggle('no-anim', Boolean(options.silent));
    }

    document.getElementById('monthLabel').textContent =
      `${MONTH_SHORT[this.selectedMonth]} ${this.selectedYear}`;

    this.updateSyncPill();

    if (this.currentTab === 'home') this.renderHomeView();
    if (this.currentTab === 'transactions') this.renderTransactionsView();
    if (this.currentTab === 'analytics') this.renderAnalyticsView();
    if (this.currentTab === 'savings') this.renderSavingsView();
    if (this.currentTab === 'wishlist') this.renderWishlistView();
  },

  updateSyncPill() {
    const pill = document.getElementById('syncPill');
    const text = document.getElementById('syncPillText');
    const pending = Store.getPendingCount();

    pill.classList.remove('offline', 'pending', 'syncing');

    if (Store.isSyncing) {
      pill.classList.add('syncing');
      text.textContent = 'Sync...';
    } else if (!navigator.onLine) {
      pill.classList.add('offline');
      text.textContent = pending > 0 ? `Offline (${pending})` : 'Offline';
    } else if (!Store.canSync()) {
      pill.classList.add('pending');
      text.textContent = 'Lokal';
    } else if (pending > 0) {
      pill.classList.add('pending');
      text.textContent = `Antre (${pending})`;
    } else {
      text.textContent = 'Cloud';
    }
  },

  /* ========================================================================
     VIEW 1: RINGKASAN (HOME)
     ======================================================================== */
  renderHomeView() {
    const ym = this.getSelectedYM();
    const monthTx = this.getMonthTransactions(ym);
    const totalBalance = this.getTotalBalance();

    const monthIncome = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const monthExpense = monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

    const totalSavings = Store.state.savingsBooks
      .filter((b) => !b.deleted)
      .reduce((s, b) => s + Number(b.balance || 0), 0);

    const activeWish = Store.state.wishlist.filter((w) => !w.deleted && w.status === 'pending');
    const recentTx = monthTx.slice(0, 5);
    const cur = CurrencyFormat.getDisplayCurrency();
    const rates = CurrencyFormat.getRates();
    const fxNote = cur === 'IDR'
      ? ''
      : `Pratinjau ${cur} · 1 ${cur} = Rp ${Math.round(rates[cur]).toLocaleString('id-ID')}${rates.source === 'live' ? ' (Live)' : ' (Cache)'}`;

    const homeEl = document.getElementById('homeContainer');
    homeEl.innerHTML = `
      <div class="home-grid">
        <div class="home-primary">
          <div class="hero-card stagger-item" style="--i:0;">
            <div class="hero-top-row">
              <div class="hero-eyebrow">Saldo Tersedia</div>
              <div class="hero-fx-pills" role="group" aria-label="Pilih pratinjau mata uang">
                ${CURRENCY_CYCLE.map((c) => `
                  <button type="button" class="hero-fx-btn ${cur === c ? 'active' : ''}" data-set-cur="${c}">${c}</button>
                `).join('')}
              </div>
            </div>
            <div class="hero-balance num amount-pop">${formatRpFull(totalBalance)}</div>
            <div class="hero-fx-note">${escapeHtml(fxNote)}</div>
            <div class="hero-metrics">
              <div class="hero-metric">
                <div class="hero-metric-label">↓ Pemasukan ${MONTH_SHORT[this.selectedMonth]}</div>
                <div class="hero-metric-val num">${formatRpFull(monthIncome)}</div>
              </div>
              <div class="hero-metric">
                <div class="hero-metric-label">↑ Pengeluaran ${MONTH_SHORT[this.selectedMonth]}</div>
                <div class="hero-metric-val num">${formatRpFull(monthExpense)}</div>
              </div>
            </div>
          </div>

          <div class="quick-actions stagger-item" style="--i:1;">
            <button type="button" class="quick-btn expense-btn md-ripple" id="quickAddExpense">
              <span class="quick-badge">−</span> Pengeluaran
            </button>
            <button type="button" class="quick-btn income-btn md-ripple" id="quickAddIncome">
              <span class="quick-badge">+</span> Pemasukan
            </button>
          </div>

          <div class="stat-grid stagger-item" style="--i:2;">
            <button type="button" class="stat-box md-ripple" id="homeGoSavings">
              <div class="stat-box-label">Buku Tabungan</div>
              <div class="stat-box-val num" style="color:var(--savings);">${formatRpFull(totalSavings)}</div>
            </button>
            <button type="button" class="stat-box md-ripple" id="homeGoWishlist">
              <div class="stat-box-label">Wishlist Aktif</div>
              <div class="stat-box-val num" style="color:var(--wishlist);">${activeWish.length} Item</div>
            </button>
          </div>
        </div>

        <div class="home-secondary">
          <div class="section-header" style="margin-top:0;">
            <h2 class="section-title">Transaksi ${MONTH_FULL[this.selectedMonth]}</h2>
            <button type="button" class="section-link md-ripple" id="homeSeeAllTx">Lihat Semua</button>
          </div>

          <div class="tx-list" id="homeRecentList">
            ${recentTx.length ? recentTx.map((t, idx) => this.renderTxItemHtml(t, idx)).join('') : '<div class="card empty-state">Belum ada transaksi di bulan ini.<br>Ketuk tombol di atas untuk mulai mencatat.</div>'}
          </div>
        </div>
      </div>
    `;

    homeEl.querySelectorAll('[data-set-cur]').forEach((btn) => {
      btn.addEventListener('click', () => this.setDisplayCurrency(btn.dataset.setCur));
    });
    document.getElementById('quickAddExpense').addEventListener('click', () => this.openTransactionModal(null, 'expense'));
    document.getElementById('quickAddIncome').addEventListener('click', () => this.openTransactionModal(null, 'income'));
    document.getElementById('homeGoSavings').addEventListener('click', () => this.switchTab('savings', 'right'));
    document.getElementById('homeGoWishlist').addEventListener('click', () => this.switchTab('wishlist', 'right'));
    document.getElementById('homeSeeAllTx').addEventListener('click', () => this.switchTab('transactions', 'right'));

    homeEl.querySelectorAll('.tx-item').forEach((el) => {
      el.addEventListener('click', () => this.openTransactionDetailSheet(el.dataset.id));
    });
  },

  renderTxItemHtml(t, idx = 0) {
    const icon = this.getCategoryIcon(t.category, t.type);
    const sign = t.type === 'income' ? '+' : '−';
    const subParts = [t.method || 'Tunai'];
    if (t.note) subParts.push(t.note);
    const hasFxOrig = t.currency && t.currency !== 'IDR' && Number(t.originalAmount) > 0;
    const origBadge = hasFxOrig
      ? `<div><span class="tx-orig-badge num">${escapeHtml(CurrencyFormat.formatOriginal(t.originalAmount, t.currency))}</span></div>`
      : '';

    return `
      <button type="button" class="tx-item md-ripple stagger-item" style="--i:${Math.min(idx, 10)};" data-id="${escapeHtml(t.id)}">
        <span class="tx-icon ${t.type}">${icon}</span>
        <span class="tx-info">
          <div class="tx-title">${escapeHtml(t.category)}</div>
          <div class="tx-sub">${escapeHtml(subParts.join(' · '))}</div>
        </span>
        <span class="tx-amount-col">
          <span class="tx-amount ${t.type} num">${sign}${formatRpFull(t.amount)}</span>
          ${origBadge}
        </span>
      </button>
    `;
  },

  /* ========================================================================
     VIEW 2: TRANSAKSI DETAIL
     ======================================================================== */
  renderTransactionsView() {
    const ym = this.getSelectedYM();
    let list = this.getMonthTransactions(ym);

    if (this.txFilterType !== 'all') {
      list = list.filter((t) => t.type === this.txFilterType);
    }

    if (this.txSearch) {
      list = list.filter((t) => {
        const hay = `${t.category} ${t.note} ${t.method} ${t.date} ${t.currency || 'IDR'}`.toLowerCase();
        return hay.includes(this.txSearch);
      });
    }

    const container = document.getElementById('txListContainer');
    if (!list.length) {
      container.innerHTML = '<div class="card empty-state">Tidak ada transaksi yang cocok dengan filter ini.</div>';
      return;
    }

    const grouped = new Map();
    list.forEach((t) => {
      const key = t.date || 'Tanpa Tanggal';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(t);
    });

    let html = '';
    let i = 0;
    grouped.forEach((items, dateKey) => {
      html += `<div class="date-group-label">${escapeHtml(this.formatDateHuman(dateKey))}</div>`;
      html += `<div class="tx-list">${items.map((t) => this.renderTxItemHtml(t, i++)).join('')}</div>`;
    });

    container.innerHTML = html;
    container.querySelectorAll('.tx-item').forEach((el) => {
      el.addEventListener('click', () => this.openTransactionDetailSheet(el.dataset.id));
    });
  },

  /* ========================================================================
     VIEW 3: ANALITIK, KALENDER TRANSAKSI & DIAGRAM INTERAKTIF
     ======================================================================== */
  renderAnalyticsView() {
    const ym = this.getSelectedYM();
    const monthTx = this.getMonthTransactions(ym);
    const income = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const expense = monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const net = income - expense;
    const saveRate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;

    document.getElementById('analyticsStats').innerHTML = `
      <div class="stat-box stagger-item" style="--i:0;">
        <div class="stat-box-label">Arus Kas Bersih</div>
        <div class="stat-box-val num" style="color:${net >= 0 ? 'var(--income)' : 'var(--expense)'};">
          ${net >= 0 ? '+' : ''}${formatRpFull(net)}
        </div>
      </div>
      <div class="stat-box stagger-item" style="--i:1;">
        <div class="stat-box-label">Rasio Sisa Dana</div>
        <div class="stat-box-val num" style="color:var(--md-sys-color-primary);">${saveRate}%</div>
      </div>
    `;

    // Render Kalender Transaksi Interaktif
    this.renderAnalyticsCalendar(monthTx);

    // Donut chart data (pengeluaran per kategori)
    const catMap = new Map();
    monthTx.filter((t) => t.type === 'expense').forEach((t) => {
      catMap.set(t.category, (catMap.get(t.category) || 0) + Number(t.amount));
    });
    const donutItems = Array.from(catMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    renderDonutChart(document.getElementById('donutChartBox'), donutItems, expense);

    // 6-Month Cashflow Bar Chart data
    const monthsData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(this.selectedYear, this.selectedMonth - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      const txs = this.getMonthTransactions(key);
      monthsData.push({
        label: MONTH_SHORT[m],
        fullLabel: `${MONTH_FULL[m]} ${y}`,
        income: txs.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
        expense: txs.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
      });
    }

    renderCashflowBarChart(document.getElementById('barChartBox'), monthsData);
  },

  renderAnalyticsCalendar(monthTx) {
    const box = document.getElementById('analyticsCalendarBox');
    if (!box) return;

    const year = this.selectedYear;
    const month = this.selectedMonth;
    const ym = this.getSelectedYM();
    const firstDow = new Date(year, month, 1).getDay(); // 0=Min..6=Sab
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = todayIso();

    // Peta transaksi per tanggal
    const byDate = new Map();
    monthTx.forEach((t) => {
      if (!byDate.has(t.date)) byDate.set(t.date, []);
      byDate.get(t.date).push(t);
    });

    // Pastikan tanggal terpilih berada di bulan yang sedang dilihat
    if (!this.selectedAnalyticsDate || !this.selectedAnalyticsDate.startsWith(ym)) {
      if (today.startsWith(ym)) {
        this.selectedAnalyticsDate = today;
      } else if (monthTx.length) {
        this.selectedAnalyticsDate = monthTx[0].date;
      } else {
        this.selectedAnalyticsDate = '';
      }
    }

    let cellsHtml = '';
    for (let i = 0; i < firstDow; i++) {
      cellsHtml += '<div class="cal-day empty"></div>';
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${ym}-${String(day).padStart(2, '0')}`;
      const txs = byDate.get(iso) || [];
      const hasInc = txs.some((t) => t.type === 'income');
      const hasExp = txs.some((t) => t.type === 'expense');
      const classes = ['cal-day', 'md-ripple'];
      if (txs.length) classes.push('has-tx');
      if (iso === today) classes.push('today');
      if (iso === this.selectedAnalyticsDate) classes.push('selected');

      cellsHtml += `
        <button type="button" class="${classes.join(' ')}" data-cal-date="${iso}" aria-label="${day} ${MONTH_FULL[month]} ${year}">
          <span class="num">${day}</span>
          <span class="cal-dots">
            ${hasInc ? '<span class="cal-dot inc"></span>' : ''}
            ${hasExp ? '<span class="cal-dot exp"></span>' : ''}
          </span>
        </button>
      `;
    }

    // Panel detail harian untuk tanggal yang dipilih
    let detailHtml = '';
    if (this.selectedAnalyticsDate) {
      const dayTxs = byDate.get(this.selectedAnalyticsDate) || [];
      const dayInc = dayTxs.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      const dayExp = dayTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

      detailHtml = `
        <div class="cal-day-detail">
          <div class="cal-day-detail-head">
            <div class="cal-day-detail-title">${escapeHtml(this.formatDateHuman(this.selectedAnalyticsDate))} (${dayTxs.length} transaksi)</div>
            <button type="button" class="section-link md-ripple" id="calAddTxDateBtn">+ Catat</button>
          </div>
          ${dayTxs.length ? `
            <div class="cal-day-summary num">
              <span style="color:var(--income);">Masuk: +${formatRpFull(dayInc)}</span>
              <span style="color:var(--expense);">Keluar: −${formatRpFull(dayExp)}</span>
            </div>
            <div class="tx-list">
              ${dayTxs.map((t, idx) => this.renderTxItemHtml(t, idx)).join('')}
            </div>
          ` : '<div class="helper-text" style="text-align:center;padding:8px 0;">Tidak ada transaksi pada tanggal ini.</div>'}
        </div>
      `;
    }

    box.innerHTML = `
      <div class="cal-weekdays">
        ${WEEKDAYS_SHORT.map((d) => `<span>${d}</span>`).join('')}
      </div>
      <div class="cal-grid">${cellsHtml}</div>
      ${detailHtml}
    `;

    box.querySelectorAll('[data-cal-date]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.haptic(6);
        this.selectedAnalyticsDate = btn.dataset.calDate;
        this.renderAnalyticsCalendar(monthTx);
      });
    });

    const addDateBtn = box.querySelector('#calAddTxDateBtn');
    if (addDateBtn) {
      addDateBtn.addEventListener('click', () => {
        this.openTransactionModal(null, 'expense', this.selectedAnalyticsDate);
      });
    }

    box.querySelectorAll('.tx-item').forEach((el) => {
      el.addEventListener('click', () => this.openTransactionDetailSheet(el.dataset.id));
    });
  },

  /* ========================================================================
     VIEW 4: BUKU TABUNGAN DIGITAL
     ======================================================================== */
  renderSavingsView() {
    const books = Store.state.savingsBooks.filter((b) => !b.deleted);
    const totalSavings = books.reduce((s, b) => s + Number(b.balance || 0), 0);
    const totalTarget = books.reduce((s, b) => s + Number(b.target || 0), 0);
    const overallPct = totalTarget > 0 ? Math.min(100, Math.round((totalSavings / totalTarget) * 100)) : 0;

    const container = document.getElementById('savingsContainer');
    container.innerHTML = `
      <div class="savings-hero stagger-item" style="--i:0;">
        <div class="hero-eyebrow">Total Saldo Buku Tabungan</div>
        <div class="hero-balance num" style="margin-bottom:10px;">${formatRpFull(totalSavings)}</div>
        <div style="display:flex;justify-content:space-between;font-size:12px;opacity:0.9;font-weight:600;">
          <span>${books.length} Buku Tabungan Aktif</span>
          <span>Target Tercapai: ${overallPct}%</span>
        </div>
      </div>

      <div class="section-header" style="margin-top:8px;">
        <h2 class="section-title">Daftar Buku Tabungan</h2>
        <button type="button" class="section-link md-ripple" id="addBookBtn">+ Buku Baru</button>
      </div>

      <div class="cards-grid">
      ${books.length ? books.map((b, idx) => {
      const pct = b.target > 0 ? Math.min(100, Math.round((b.balance / b.target) * 100)) : 0;
      return `
          <div class="book-card md-ripple stagger-item" style="--i:${idx + 1};" data-id="${escapeHtml(b.id)}">
            <div class="book-header">
              <div>
                <h3 class="book-name">${escapeHtml(b.name)}</h3>
                <div class="book-note">${escapeHtml(b.note || 'Ketuk untuk buka buku mutasi')}</div>
              </div>
              <span class="book-badge num">${pct}%</span>
            </div>
            <div class="book-amounts">
              <span class="book-balance num">${formatRpFull(b.balance)}</span>
              <span class="book-target num">Target ${formatRpFull(b.target)}</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width:${pct}%; background:${escapeHtml(b.color || 'var(--savings)')};"></div>
            </div>
          </div>
        `;
    }).join('') : '<div class="card empty-state" style="grid-column:1/-1;">Belum ada buku tabungan.<br>Buat buku tabungan pertama Anda untuk mencatat setoran & penarikan.</div>'}
      </div>
    `;

    document.getElementById('addBookBtn').addEventListener('click', () => this.openBookModal());
    container.querySelectorAll('.book-card').forEach((card) => {
      card.addEventListener('click', () => this.openBookDetailModal(card.dataset.id));
    });
  },

  /* ========================================================================
     VIEW 5: WISHLIST
     ======================================================================== */
  renderWishlistView() {
    const allWish = Store.state.wishlist.filter((w) => !w.deleted);
    const pendingList = allWish.filter((w) => w.status === 'pending');
    const filtered = allWish.filter((w) => w.status === this.wishFilter);
    const totalPendingCost = pendingList.reduce((s, w) => s + Number(w.price || 0), 0);
    const currentBalance = Math.max(0, this.getTotalBalance());

    const priorityLabel = { high: 'Prioritas Tinggi', medium: 'Sedang', low: 'Santai' };
    const priorityOrder = { high: 1, medium: 2, low: 3 };
    filtered.sort((a, b) => (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2));

    const container = document.getElementById('wishlistContainer');
    container.innerHTML = `
      <div class="card stagger-item" style="--i:0;display:flex;justify-content:space-between;align-items:center;gap:12px;">
        <div style="min-width:0;">
          <div style="font-size:12px;color:var(--md-sys-color-on-surface-variant);font-weight:600;">Total Estimasi Wishlist Aktif</div>
          <div class="num" style="font-size:20px;font-weight:800;margin-top:2px;overflow:hidden;text-overflow:ellipsis;">${formatRpFull(totalPendingCost)}</div>
          <div style="font-size:12px;color:var(--md-sys-color-on-surface-variant);margin-top:2px;">${pendingList.length} item menunggu</div>
        </div>
        <button type="button" class="btn btn-primary btn-sm md-ripple" id="addWishBtn" style="flex-shrink:0;">+ Tambah</button>
      </div>

      <div class="cards-grid">
      ${filtered.length ? filtered.map((w, idx) => {
      const pct = w.price > 0 ? Math.min(100, Math.round((currentBalance / w.price) * 100)) : 100;
      const isDone = w.status === 'achieved';
      return `
          <div class="wish-card stagger-item" style="--i:${idx + 1};">
            <div class="wish-top">
              <div>
                <h3 class="wish-title">${escapeHtml(w.name)}</h3>
                <div class="wish-meta">${escapeHtml(w.category || 'Belanja')}${w.note ? ' · ' + escapeHtml(w.note) : ''}</div>
              </div>
              <span class="priority-pill ${isDone ? 'priority-done' : 'priority-' + (w.priority || 'medium')}">
                ${isDone ? 'Tercapai' : (priorityLabel[w.priority] || 'Sedang')}
              </span>
            </div>
            <div class="wish-price-row">
              <span class="wish-price num">${formatRpFull(w.price)}</span>
              ${!isDone ? `<span style="font-size:12px;color:var(--md-sys-color-on-surface-variant);" class="num">Kesiapan saldo ${pct}%</span>` : ''}
            </div>
            ${!isDone ? `
              <div class="progress-track">
                <div class="progress-fill" style="width:${pct}%;background:${pct >= 100 ? 'var(--income)' : 'var(--wishlist)'};"></div>
              </div>
            ` : ''}
            <div class="wish-actions">
              ${!isDone ? `<button type="button" class="btn btn-success btn-sm md-ripple" style="flex:1;" data-buy="${escapeHtml(w.id)}">✓ Beli & Catat</button>` : ''}
              <button type="button" class="btn btn-secondary btn-sm md-ripple" data-edit-wish="${escapeHtml(w.id)}">Edit</button>
              <button type="button" class="btn btn-danger btn-sm md-ripple" data-del-wish="${escapeHtml(w.id)}">Hapus</button>
            </div>
          </div>
        `;
    }).join('') : '<div class="card empty-state" style="grid-column:1/-1;">Belum ada daftar wishlist pada kategori ini.</div>'}
      </div>
    `;

    document.getElementById('addWishBtn').addEventListener('click', () => this.openWishlistModal());
    container.querySelectorAll('[data-buy]').forEach((btn) => {
      btn.addEventListener('click', () => this.fulfillWishlist(btn.dataset.buy));
    });
    container.querySelectorAll('[data-edit-wish]').forEach((btn) => {
      btn.addEventListener('click', () => this.openWishlistModal(btn.dataset.editWish));
    });
    container.querySelectorAll('[data-del-wish]').forEach((btn) => {
      btn.addEventListener('click', () => this.deleteWishlist(btn.dataset.delWish));
    });
  },

  /* ========================================================================
     MODALS (M3 BOTTOM SHEET + SWIPE TO DISMISS)
     ======================================================================== */
  openModal(title, bodyHtml) {
    const backdrop = document.getElementById('modalBackdrop');
    const sheet = document.getElementById('modalSheet');
    sheet.classList.remove('is-dragging');
    sheet.style.transform = '';
    sheet.style.transition = '';
    sheet.style.animation = '';
    backdrop.style.background = '';
    sheet.innerHTML = `
      <div class="sheet-drag-zone" id="sheetDragZone">
        <div class="sheet-handle"></div>
      </div>
      <div class="sheet-header" id="sheetHeader">
        <h3 class="sheet-title">${escapeHtml(title)}</h3>
        <button type="button" class="close-btn md-ripple" id="closeModalBtn" aria-label="Tutup">×</button>
      </div>
      ${bodyHtml}
    `;
    backdrop.classList.add('open');
    document.getElementById('closeModalBtn').addEventListener('click', () => this.closeModal());

    // Gestur geser (swipe/drag) pada bar atas bottom sheet (mendukung sentuh & mouse/trackpad)
    const dragTargets = [
      document.getElementById('sheetDragZone'),
      document.getElementById('sheetHeader')
    ].filter(Boolean);

    let isDragging = false;
    let activePointerId = null;
    let startY = 0;
    let startTime = 0;
    let currentDeltaY = 0;

    const onPointerDown = (e) => {
      if (e.target.closest('#closeModalBtn')) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      isDragging = true;
      activePointerId = e.pointerId;
      startY = e.clientY;
      startTime = Date.now();
      currentDeltaY = 0;
      sheet.classList.add('is-dragging');
      sheet.style.animation = 'none';
      sheet.style.transition = 'none';
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch (err) { }
    };

    const onPointerMove = (e) => {
      if (!isDragging || e.pointerId !== activePointerId) return;
      const rawDelta = e.clientY - startY;
      if (rawDelta >= 0) {
        currentDeltaY = rawDelta;
        sheet.style.transform = `translateY(${rawDelta}px)`;
        const progress = Math.min(1, rawDelta / 280);
        backdrop.style.background = `rgba(0, 0, 0, ${(0.48 * (1 - progress * 0.65)).toFixed(3)})`;
      } else {
        // Efek elastis lembut saat digeser ke atas
        currentDeltaY = rawDelta;
        const resist = Math.max(-24, rawDelta * 0.18);
        sheet.style.transform = `translateY(${resist}px)`;
      }
    };

    const finishDrag = (e) => {
      if (!isDragging || e.pointerId !== activePointerId) return;
      isDragging = false;
      activePointerId = null;
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch (err) { }

      sheet.classList.remove('is-dragging');
      const elapsed = Math.max(1, Date.now() - startTime);
      const velocity = currentDeltaY / elapsed; // px per ms
      const shouldClose = currentDeltaY > 85 || (currentDeltaY > 36 && velocity > 0.45);

      if (shouldClose) {
        sheet.style.transition = 'transform 0.22s ease-out';
        sheet.style.transform = 'translateY(100%)';
        backdrop.style.background = 'rgba(0, 0, 0, 0)';
        setTimeout(() => this.closeModal(), 200);
      } else {
        sheet.style.transition = 'transform 0.26s cubic-bezier(0.34, 1.32, 0.64, 1)';
        sheet.style.transform = 'translateY(0)';
        backdrop.style.background = '';
      }
    };

    dragTargets.forEach((el) => {
      el.addEventListener('pointerdown', onPointerDown);
      el.addEventListener('pointermove', onPointerMove);
      el.addEventListener('pointerup', finishDrag);
      el.addEventListener('pointercancel', finishDrag);
    });
  },

  closeModal() {
    const backdrop = document.getElementById('modalBackdrop');
    const sheet = document.getElementById('modalSheet');
    sheet.classList.remove('is-dragging');
    sheet.style.transform = '';
    sheet.style.transition = '';
    sheet.style.animation = '';
    backdrop.style.background = '';
    backdrop.classList.remove('open');
  },

  openConfirmSheet({ title, message, confirmText = 'Lanjutkan', confirmClass = 'btn-danger', onConfirm }) {
    const html = `
      <p style="margin:0 0 16px;font-size:14px;color:var(--md-sys-color-on-surface-variant);line-height:1.5;">${escapeHtml(message)}</p>
      <div class="row-2">
        <button type="button" class="btn btn-secondary md-ripple" id="confirmCancelBtn">Batal</button>
        <button type="button" class="btn ${confirmClass} md-ripple" id="confirmOkBtn">${escapeHtml(confirmText)}</button>
      </div>
    `;
    this.openModal(title, html);
    document.getElementById('confirmCancelBtn').addEventListener('click', () => this.closeModal());
    document.getElementById('confirmOkBtn').addEventListener('click', () => {
      this.closeModal();
      if (onConfirm) onConfirm();
    });
  },

  /* --- Modal: Popup Date & Month Picker --- */
  openDatePickerModal() {
    let pickerYear = this.selectedYear;
    const allTx = this.getActiveTransactions();
    const monthsWithTx = new Set(allTx.map((t) => (t.date || '').slice(0, 7)));

    const renderPickerBody = () => {
      const sheet = document.getElementById('modalSheet');
      const monthsHtml = MONTH_SHORT.map((label, mIdx) => {
        const key = `${pickerYear}-${String(mIdx + 1).padStart(2, '0')}`;
        const isActive = pickerYear === this.selectedYear && mIdx === this.selectedMonth;
        const hasTx = monthsWithTx.has(key);
        return `
          <button type="button" class="picker-month-btn md-ripple ${isActive ? 'active' : ''}" data-pick-month="${mIdx}">
            <span>${label}</span>
            ${hasTx ? '<span class="picker-month-dot"></span>' : ''}
          </button>
        `;
      }).join('');

      const jumpVal = this.selectedAnalyticsDate || `${this.getSelectedYM()}-01`;

      const html = `
        <div class="picker-year-bar">
          <button type="button" class="month-btn md-ripple" id="pickerPrevYear" aria-label="Tahun sebelumnya">‹</button>
          <span class="picker-year-label num">${pickerYear}</span>
          <button type="button" class="month-btn md-ripple" id="pickerNextYear" aria-label="Tahun berikutnya">›</button>
        </div>

        <div class="picker-month-grid">${monthsHtml}</div>

        <div class="form-group" style="border-top:1px solid var(--md-sys-color-outline-variant);padding-top:12px;">
          <label class="form-label" for="pickerExactDate">Atau Lompat ke Tanggal Spesifik</label>
          <div style="display:flex;gap:8px;">
            <input type="date" id="pickerExactDate" class="form-control" value="${escapeHtml(jumpVal)}" style="flex:1;">
            <button type="button" class="btn btn-tonal md-ripple" id="pickerJumpDateBtn">Buka</button>
          </div>
        </div>

        <button type="button" class="btn btn-secondary btn-full btn-sm md-ripple" id="pickerTodayBtn">Kembali ke Bulan Ini</button>
      `;

      this.openModal('Pilih Bulan & Tanggal', html);

      sheet.querySelector('#pickerPrevYear').addEventListener('click', () => {
        pickerYear -= 1;
        renderPickerBody();
      });
      sheet.querySelector('#pickerNextYear').addEventListener('click', () => {
        pickerYear += 1;
        renderPickerBody();
      });
      sheet.querySelectorAll('[data-pick-month]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.selectedYear = pickerYear;
          this.selectedMonth = Number(btn.dataset.pickMonth);
          this.selectedAnalyticsDate = '';
          this.closeModal();
          this.render();
        });
      });
      sheet.querySelector('#pickerJumpDateBtn').addEventListener('click', () => {
        const val = sheet.querySelector('#pickerExactDate').value;
        if (!val) return;
        const [y, m] = val.split('-').map(Number);
        if (y && m) {
          this.selectedYear = y;
          this.selectedMonth = m - 1;
          this.selectedAnalyticsDate = val;
          this.closeModal();
          this.render();
          this.showToast(`Menampilkan ${this.formatDateHuman(val)}`);
        }
      });
      sheet.querySelector('#pickerTodayBtn').addEventListener('click', () => {
        const now = new Date();
        this.selectedYear = now.getFullYear();
        this.selectedMonth = now.getMonth();
        this.selectedAnalyticsDate = todayIso();
        this.closeModal();
        this.render();
      });
    };

    renderPickerBody();
  },

  /* --- Modal: Detail Transaksi --- */
  openTransactionDetailSheet(txId) {
    const t = Store.state.transactions.find((x) => x.id === txId && !x.deleted);
    if (!t) return;
    const isInc = t.type === 'income';
    const icon = this.getCategoryIcon(t.category, t.type);
    const hasFx = t.currency && t.currency !== 'IDR' && Number(t.originalAmount) > 0;

    const html = `
      <div style="text-align:center;padding:6px 0 14px;">
        <div class="tx-icon ${t.type}" style="width:54px;height:54px;border-radius:20px;margin:0 auto 10px;font-size:24px;">${icon}</div>
        <div class="num" style="font-size:26px;font-weight:800;color:${isInc ? 'var(--income)' : 'var(--expense)'};">
          ${isInc ? '+' : '−'}${formatRpFull(t.amount)}
        </div>
        ${hasFx ? `<div class="helper-text num">Nominal Asal: ${escapeHtml(CurrencyFormat.formatOriginal(t.originalAmount, t.currency))} (Kurs Rp ${Math.round(Number(t.exchangeRate) || 0).toLocaleString('id-ID')})</div>` : ''}
        <div style="font-size:13px;color:var(--md-sys-color-on-surface-variant);margin-top:3px;">${escapeHtml(t.category)}</div>
      </div>

      <div class="detail-kv-list">
        <div class="detail-kv">
          <span class="detail-kv-label">Tipe</span>
          <span class="detail-kv-val">${isInc ? 'Pemasukan' : 'Pengeluaran'}</span>
        </div>
        <div class="detail-kv">
          <span class="detail-kv-label">Nilai Rupiah (Utama)</span>
          <span class="detail-kv-val num">${CurrencyFormat.formatOriginal(t.amount, 'IDR')}</span>
        </div>
        <div class="detail-kv">
          <span class="detail-kv-label">Tanggal</span>
          <span class="detail-kv-val">${escapeHtml(this.formatDateHuman(t.date))}</span>
        </div>
        <div class="detail-kv">
          <span class="detail-kv-label">Metode</span>
          <span class="detail-kv-val">${escapeHtml(t.method || 'Tunai')}</span>
        </div>
        <div class="detail-kv">
          <span class="detail-kv-label">Catatan</span>
          <span class="detail-kv-val">${escapeHtml(t.note || '—')}</span>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;">
        <button type="button" class="btn btn-primary btn-sm md-ripple" id="detailEditTxBtn">Edit</button>
        <button type="button" class="btn btn-tonal btn-sm md-ripple" id="detailDupTxBtn">Duplikat</button>
        <button type="button" class="btn btn-danger btn-sm md-ripple" id="detailDelTxBtn">Hapus</button>
      </div>
    `;

    this.openModal('Detail Transaksi', html);

    document.getElementById('detailEditTxBtn').addEventListener('click', () => this.openTransactionModal(t.id));
    document.getElementById('detailDupTxBtn').addEventListener('click', () => {
      Store.state.transactions.push(Object.assign({}, t, {
        id: uid('tx'),
        date: todayIso(),
        updatedAt: new Date().toISOString(),
        syncStatus: 'pending'
      }));
      Store.save();
      this.scheduleAutoSync();
      this.closeModal();
      this.showToast('Transaksi diduplikasi untuk hari ini');
    });
    document.getElementById('detailDelTxBtn').addEventListener('click', () => {
      this.openConfirmSheet({
        title: 'Hapus Transaksi?',
        message: `Transaksi "${t.category}" sebesar ${formatRpFull(t.amount)} akan dihapus dari catatan dan disinkronkan ke cloud.`,
        confirmText: 'Ya, Hapus',
        onConfirm: () => {
          t.deleted = true;
          t.updatedAt = new Date().toISOString();
          t.syncStatus = 'pending';
          Store.save();
          this.scheduleAutoSync();
          this.showToast('Transaksi dihapus');
        }
      });
    });
  },

  /* --- Modal: Tambah / Edit Transaksi (Multi-Currency IDR / USD / SAR + Auto-Format) --- */
  openTransactionModal(txId = null, defaultType = 'expense', defaultDate = null) {
    const existing = txId ? Store.state.transactions.find((t) => t.id === txId) : null;
    let currentType = existing ? existing.type : defaultType;
    let currentCurrency = (existing && existing.currency) || CurrencyFormat.getDisplayCurrency() || 'IDR';
    const initialRaw = existing
      ? (existing.currency && existing.currency !== 'IDR' && existing.originalAmount ? existing.originalAmount : existing.amount)
      : '';

    const buildCategoryOptions = (type, selectedCat) => {
      const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
      return list.map((c) => `<option value="${escapeHtml(c.name)}" ${c.name === selectedCat ? 'selected' : ''}>${c.icon} ${escapeHtml(c.name)}</option>`).join('');
    };

    const html = `
      <form id="txForm">
        <div class="form-group">
          <div class="segmented" id="txTypeSeg">
            <button type="button" class="seg-btn md-ripple expense ${currentType === 'expense' ? 'active' : ''}" data-type="expense">Pengeluaran</button>
            <button type="button" class="seg-btn md-ripple income ${currentType === 'income' ? 'active' : ''}" data-type="income">Pemasukan</button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Mata Uang Input</label>
          <div class="segmented cols-3" id="txCurrencySeg">
            <button type="button" class="seg-btn md-ripple ${currentCurrency === 'IDR' ? 'active' : ''}" data-cur="IDR">IDR (Rp)</button>
            <button type="button" class="seg-btn md-ripple ${currentCurrency === 'USD' ? 'active' : ''}" data-cur="USD">USD ($)</button>
            <button type="button" class="seg-btn md-ripple ${currentCurrency === 'SAR' ? 'active' : ''}" data-cur="SAR">SAR (﷼)</button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="txAmount" id="txAmountLabel">Nominal (${currentCurrency})</label>
          <div class="currency-input-wrap">
            <span class="currency-prefix" id="txAmountPrefix">${CurrencyFormat.getSymbol(currentCurrency)}</span>
            <input id="txAmount" class="form-control num" type="text" inputmode="${currentCurrency === 'IDR' ? 'numeric' : 'decimal'}" autocomplete="off" required placeholder="${currentCurrency === 'IDR' ? '50.000' : '25.00'}" value="${initialRaw ? escapeHtml(CurrencyFormat.formatForInput(initialRaw, currentCurrency)) : ''}">
          </div>
          <div class="fx-preview-box" id="txFxPreview" style="display:${currentCurrency === 'IDR' ? 'none' : 'flex'};">
            <span id="txFxConverted">≈ Rp 0</span>
            <span id="txFxRateLabel" class="num"></span>
          </div>
        </div>

        <div class="row-2">
          <div class="form-group">
            <label class="form-label" for="txCategory">Kategori</label>
            <select id="txCategory" class="form-control">${buildCategoryOptions(currentType, existing ? existing.category : '')}</select>
          </div>
          <div class="form-group">
            <label class="form-label" for="txDate">Tanggal</label>
            <input id="txDate" class="form-control" type="date" required value="${existing ? existing.date : (defaultDate || todayIso())}">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="txMethod">Metode Pembayaran</label>
          <select id="txMethod" class="form-control">
            ${PAYMENT_METHODS.map((m) => `<option value="${escapeHtml(m)}" ${existing && existing.method === m ? 'selected' : ''}>${escapeHtml(m)}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" for="txNote">Catatan Detail</label>
          <textarea id="txNote" class="form-control" placeholder="Contoh: Makan siang, oleh-oleh umrah, langganan cloud...">${existing ? escapeHtml(existing.note) : ''}</textarea>
        </div>

        <div style="display:flex;gap:8px;margin-top:6px;">
          ${existing ? '<button type="button" class="btn btn-danger md-ripple" id="deleteTxBtn">Hapus</button>' : ''}
          <button type="submit" class="btn btn-primary md-ripple" style="flex:1;">${existing ? 'Simpan Perubahan' : 'Simpan Transaksi'}</button>
        </div>
      </form>
    `;

    this.openModal(existing ? 'Edit Transaksi' : 'Catat Transaksi', html);

    const sheet = document.getElementById('modalSheet');
    const catSelect = sheet.querySelector('#txCategory');
    const amountInput = sheet.querySelector('#txAmount');
    const prefixEl = sheet.querySelector('#txAmountPrefix');
    const labelEl = sheet.querySelector('#txAmountLabel');
    const fxBox = sheet.querySelector('#txFxPreview');
    const fxConverted = sheet.querySelector('#txFxConverted');
    const fxRateLabel = sheet.querySelector('#txFxRateLabel');

    const updateFxPreview = () => {
      const val = CurrencyFormat.parseInput(amountInput.value, currentCurrency);
      if (currentCurrency === 'IDR') {
        fxBox.style.display = 'none';
      } else {
        const rates = CurrencyFormat.getRates();
        const rate = rates[currentCurrency] || 1;
        const idrVal = CurrencyFormat.convertToIdr(val, currentCurrency);
        fxBox.style.display = 'flex';
        fxConverted.textContent = `≈ ${CurrencyFormat.formatOriginal(idrVal, 'IDR')}`;
        fxRateLabel.textContent = `1 ${currentCurrency} = Rp ${Math.round(rate).toLocaleString('id-ID')}`;
      }
    };

    CurrencyFormat.attachInput(amountInput, () => currentCurrency, updateFxPreview);
    updateFxPreview();

    sheet.querySelectorAll('#txTypeSeg .seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentType = btn.dataset.type;
        sheet.querySelectorAll('#txTypeSeg .seg-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        catSelect.innerHTML = buildCategoryOptions(currentType, '');
      });
    });

    sheet.querySelectorAll('#txCurrencySeg .seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const oldVal = CurrencyFormat.parseInput(amountInput.value, currentCurrency);
        currentCurrency = btn.dataset.cur;
        sheet.querySelectorAll('#txCurrencySeg .seg-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        prefixEl.textContent = CurrencyFormat.getSymbol(currentCurrency);
        labelEl.textContent = `Nominal (${currentCurrency})`;
        amountInput.setAttribute('inputmode', currentCurrency === 'IDR' ? 'numeric' : 'decimal');
        amountInput.placeholder = currentCurrency === 'IDR' ? '50.000' : '25.00';
        amountInput.value = oldVal > 0 ? CurrencyFormat.formatForInput(oldVal, currentCurrency) : '';
        updateFxPreview();
      });
    });

    if (existing) {
      sheet.querySelector('#deleteTxBtn').addEventListener('click', () => {
        existing.deleted = true;
        existing.updatedAt = new Date().toISOString();
        existing.syncStatus = 'pending';
        Store.save();
        this.scheduleAutoSync();
        this.closeModal();
        this.showToast('Transaksi dihapus');
      });
    }

    sheet.querySelector('#txForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const origVal = CurrencyFormat.parseInput(amountInput.value, currentCurrency);
      if (!origVal || origVal <= 0) {
        this.showToast('Masukkan nominal yang valid');
        return;
      }

      const rates = CurrencyFormat.getRates();
      const usedRate = currentCurrency === 'IDR' ? 1 : (rates[currentCurrency] || 1);
      const amountIdr = CurrencyFormat.convertToIdr(origVal, currentCurrency);
      const now = new Date().toISOString();

      if (existing) {
        existing.type = currentType;
        existing.amount = amountIdr;
        existing.currency = currentCurrency;
        existing.originalAmount = origVal;
        existing.exchangeRate = usedRate;
        existing.category = sheet.querySelector('#txCategory').value;
        existing.date = sheet.querySelector('#txDate').value;
        existing.method = sheet.querySelector('#txMethod').value;
        existing.note = sheet.querySelector('#txNote').value.trim();
        existing.updatedAt = now;
        existing.syncStatus = 'pending';
      } else {
        Store.state.transactions.push({
          id: uid('tx'),
          type: currentType,
          amount: amountIdr,
          currency: currentCurrency,
          originalAmount: origVal,
          exchangeRate: usedRate,
          category: sheet.querySelector('#txCategory').value,
          date: sheet.querySelector('#txDate').value,
          method: sheet.querySelector('#txMethod').value,
          note: sheet.querySelector('#txNote').value.trim(),
          updatedAt: now,
          deleted: false,
          syncStatus: 'pending'
        });
      }

      this.haptic(12);
      Store.save();
      this.scheduleAutoSync();
      this.closeModal();
      this.showToast(existing ? 'Transaksi diperbarui' : 'Transaksi dicatat');
    });
  },

  /* --- Modal: Tambah / Edit Buku Tabungan --- */
  openBookModal(bookId = null) {
    const existing = bookId ? Store.state.savingsBooks.find((b) => b.id === bookId) : null;
    const colors = ['#006A60', '#006399', '#006E47', '#8A5100', '#C2410C'];

    const html = `
      <form id="bookForm">
        <div class="form-group">
          <label class="form-label" for="bookName">Nama Buku / Tujuan Tabungan</label>
          <input id="bookName" class="form-control" required placeholder="Contoh: Dana Darurat, Beli Laptop" value="${existing ? escapeHtml(existing.name) : ''}">
        </div>
        <div class="form-group">
          <label class="form-label" for="bookTarget">Target Nominal (Rp)</label>
          <div class="currency-input-wrap">
            <span class="currency-prefix">Rp</span>
            <input id="bookTarget" class="form-control num" type="text" inputmode="numeric" autocomplete="off" required placeholder="10.000.000" value="${existing ? escapeHtml(CurrencyFormat.formatForInput(existing.target, 'IDR')) : ''}">
          </div>
        </div>
        ${!existing ? `
          <div class="form-group">
            <label class="form-label" for="bookInitial">Saldo Awal (Rp, opsional)</label>
            <div class="currency-input-wrap">
              <span class="currency-prefix">Rp</span>
              <input id="bookInitial" class="form-control num" type="text" inputmode="numeric" autocomplete="off" placeholder="0" value="">
            </div>
          </div>
        ` : ''}
        <div class="form-group">
          <label class="form-label" for="bookColor">Warna Label</label>
          <select id="bookColor" class="form-control">
            ${colors.map((c, idx) => `<option value="${c}" ${existing && existing.color === c ? 'selected' : ''}>Tema ${idx + 1} (${c})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="bookNote">Catatan</label>
          <input id="bookNote" class="form-control" placeholder="Keterangan singkat" value="${existing ? escapeHtml(existing.note) : ''}">
        </div>
        <div style="display:flex;gap:8px;">
          ${existing ? '<button type="button" class="btn btn-danger md-ripple" id="deleteBookBtn">Hapus</button>' : ''}
          <button type="submit" class="btn btn-primary md-ripple" style="flex:1;">${existing ? 'Simpan' : 'Buat Buku Tabungan'}</button>
        </div>
      </form>
    `;

    this.openModal(existing ? 'Edit Buku Tabungan' : 'Buku Tabungan Baru', html);

    const sheet = document.getElementById('modalSheet');
    CurrencyFormat.attachInput(sheet.querySelector('#bookTarget'), 'IDR');
    if (!existing) CurrencyFormat.attachInput(sheet.querySelector('#bookInitial'), 'IDR');

    if (existing) {
      sheet.querySelector('#deleteBookBtn').addEventListener('click', () => {
        existing.deleted = true;
        existing.updatedAt = new Date().toISOString();
        existing.syncStatus = 'pending';
        Store.save();
        this.scheduleAutoSync();
        this.closeModal();
        this.showToast('Buku tabungan dihapus');
      });
    }

    sheet.querySelector('#bookForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const now = new Date().toISOString();
      const name = sheet.querySelector('#bookName').value.trim();
      const target = CurrencyFormat.parseInput(sheet.querySelector('#bookTarget').value, 'IDR');
      const color = sheet.querySelector('#bookColor').value;
      const note = sheet.querySelector('#bookNote').value.trim();

      if (existing) {
        existing.name = name;
        existing.target = target;
        existing.color = color;
        existing.note = note;
        existing.updatedAt = now;
        existing.syncStatus = 'pending';
      } else {
        const initial = CurrencyFormat.parseInput(sheet.querySelector('#bookInitial').value, 'IDR');
        const newBookId = uid('book');
        Store.state.savingsBooks.push({
          id: newBookId,
          name,
          target,
          balance: initial,
          color,
          note,
          updatedAt: now,
          deleted: false,
          syncStatus: 'pending'
        });

        if (initial > 0) {
          Store.state.savingsLedger.push({
            id: uid('ldg'),
            bookId: newBookId,
            date: todayIso(),
            type: 'deposit',
            amount: initial,
            balanceAfter: initial,
            note: 'Saldo awal buku tabungan',
            updatedAt: now,
            deleted: false,
            syncStatus: 'pending'
          });
        }
      }

      this.haptic(12);
      Store.save();
      this.scheduleAutoSync();
      this.closeModal();
      this.showToast(existing ? 'Buku tabungan diperbarui' : 'Buku tabungan dibuat');
    });
  },

  /* --- Modal: Detail Buku Tabungan --- */
  openBookDetailModal(bookId) {
    const book = Store.state.savingsBooks.find((b) => b.id === bookId && !b.deleted);
    if (!book) return;

    const entries = Store.state.savingsLedger
      .filter((l) => l.bookId === bookId && !l.deleted)
      .sort((a, b) => (b.date + b.updatedAt).localeCompare(a.date + a.updatedAt));

    const pct = book.target > 0 ? Math.min(100, Math.round((book.balance / book.target) * 100)) : 0;

    const rowsHtml = entries.length
      ? entries.map((e) => `
          <tr>
            <td>
              <div style="font-weight:700;">${escapeHtml(this.formatDateHuman(e.date))}</div>
              <div style="color:var(--md-sys-color-on-surface-variant);font-size:11px;">${escapeHtml(e.note || (e.type === 'deposit' ? 'Setoran' : 'Penarikan'))}</div>
            </td>
            <td class="right num" style="font-weight:700;color:${e.type === 'deposit' ? 'var(--income)' : 'var(--expense)'};">
              ${e.type === 'deposit' ? '+' : '−'}${formatRpFull(e.amount)}
            </td>
            <td class="right num" style="font-weight:700;">${formatRpFull(e.balanceAfter)}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="3" class="empty-state">Belum ada catatan mutasi.</td></tr>';

    const html = `
      <div style="background:var(--md-sys-color-surface-container-high);border-radius:var(--shape-lg);padding:16px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-size:12px;color:var(--md-sys-color-on-surface-variant);font-weight:600;">Saldo Buku Tabungan</span>
          <button type="button" class="section-link md-ripple" id="editThisBookBtn">Edit Buku</button>
        </div>
        <div class="num" style="font-size:23px;font-weight:800;margin-bottom:10px;">${formatRpFull(book.balance)}</div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${pct}%;background:${escapeHtml(book.color || 'var(--savings)')};"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--md-sys-color-on-surface-variant);margin-top:6px;">
          <span>Tercapai ${pct}%</span>
          <span class="num">Target ${formatRpFull(book.target)}</span>
        </div>
      </div>

      <div class="row-2" style="margin-bottom:14px;">
        <button type="button" class="btn btn-primary md-ripple" id="btnDeposit">+ Setor</button>
        <button type="button" class="btn btn-tonal md-ripple" id="btnWithdraw">− Tarik</button>
      </div>

      <div style="font-size:13px;font-weight:800;margin-bottom:4px;">Riwayat Mutasi Buku Tabungan</div>
      <div class="ledger-table-wrap">
        <table class="ledger-table">
          <thead>
            <tr>
              <th>Tanggal & Ket.</th>
              <th class="right">Mutasi</th>
              <th class="right">Saldo</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;

    this.openModal(book.name, html);

    const sheet = document.getElementById('modalSheet');
    sheet.querySelector('#editThisBookBtn').addEventListener('click', () => this.openBookModal(book.id));
    sheet.querySelector('#btnDeposit').addEventListener('click', () => this.openLedgerEntryModal(book.id, 'deposit'));
    sheet.querySelector('#btnWithdraw').addEventListener('click', () => this.openLedgerEntryModal(book.id, 'withdraw'));
  },

  openLedgerEntryModal(bookId, type) {
    const book = Store.state.savingsBooks.find((b) => b.id === bookId);
    if (!book) return;
    const isDeposit = type === 'deposit';

    const html = `
      <form id="ledgerForm">
        <div class="form-group">
          <label class="form-label" for="ldgAmount">Nominal ${isDeposit ? 'Setoran' : 'Penarikan'} (Rp)</label>
          <div class="currency-input-wrap">
            <span class="currency-prefix">Rp</span>
            <input id="ldgAmount" class="form-control num" type="text" inputmode="numeric" autocomplete="off" required placeholder="250.000">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="ldgDate">Tanggal</label>
          <input id="ldgDate" class="form-control" type="date" required value="${todayIso()}">
        </div>
        <div class="form-group">
          <label class="form-label" for="ldgNote">Keterangan</label>
          <input id="ldgNote" class="form-control" placeholder="${isDeposit ? 'Contoh: Sisihkan uang harian' : 'Contoh: Tarik untuk keperluan darurat'}">
        </div>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:14px;cursor:pointer;">
          <input type="checkbox" id="ldgSyncTx" ${isDeposit ? 'checked' : ''}>
          <span>${isDeposit ? 'Catat juga sebagai Pengeluaran (kategori Tabungan)' : 'Catat juga sebagai Pemasukan di saldo utama'}</span>
        </label>
        <button type="submit" class="btn btn-primary btn-full md-ripple">${isDeposit ? 'Simpan Setoran' : 'Simpan Penarikan'}</button>
      </form>
    `;

    this.openModal(`${isDeposit ? 'Setor' : 'Tarik'} — ${book.name}`, html);

    const sheet = document.getElementById('modalSheet');
    CurrencyFormat.attachInput(sheet.querySelector('#ldgAmount'), 'IDR');

    sheet.querySelector('#ledgerForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const amount = CurrencyFormat.parseInput(sheet.querySelector('#ldgAmount').value, 'IDR');
      if (!amount || amount <= 0) return;

      if (!isDeposit && amount > book.balance) {
        this.showToast('Saldo buku tabungan tidak mencukupi');
        return;
      }

      const now = new Date().toISOString();
      const date = sheet.querySelector('#ldgDate').value;
      const note = sheet.querySelector('#ldgNote').value.trim();
      const syncTx = sheet.querySelector('#ldgSyncTx').checked;

      book.balance = Number(book.balance || 0) + (isDeposit ? amount : -amount);
      book.updatedAt = now;
      book.syncStatus = 'pending';

      Store.state.savingsLedger.push({
        id: uid('ldg'),
        bookId: book.id,
        date,
        type,
        amount,
        balanceAfter: book.balance,
        note: note || (isDeposit ? 'Setoran tabungan' : 'Penarikan tabungan'),
        updatedAt: now,
        deleted: false,
        syncStatus: 'pending'
      });

      if (syncTx) {
        Store.state.transactions.push({
          id: uid('tx'),
          date,
          type: isDeposit ? 'expense' : 'income',
          category: isDeposit ? 'Tabungan' : 'Lainnya',
          amount,
          currency: 'IDR',
          originalAmount: amount,
          exchangeRate: 1,
          method: 'Transfer Bank',
          note: `${isDeposit ? 'Setor ke' : 'Tarik dari'} ${book.name}${note ? ' — ' + note : ''}`,
          updatedAt: now,
          deleted: false,
          syncStatus: 'pending'
        });
      }

      this.haptic(12);
      Store.save();
      this.scheduleAutoSync();
      this.openBookDetailModal(book.id);
      this.showToast(isDeposit ? 'Setoran dicatat di buku tabungan' : 'Penarikan dicatat di buku tabungan');
    });
  },

  /* --- Modal: Wishlist --- */
  openWishlistModal(wishId = null) {
    const existing = wishId ? Store.state.wishlist.find((w) => w.id === wishId) : null;

    const html = `
      <form id="wishForm">
        <div class="form-group">
          <label class="form-label" for="wishName">Nama Barang / Keinginan</label>
          <input id="wishName" class="form-control" required placeholder="Contoh: Monitor Kerja 24 inch" value="${existing ? escapeHtml(existing.name) : ''}">
        </div>
        <div class="row-2">
          <div class="form-group">
            <label class="form-label" for="wishPrice">Estimasi Harga (Rp)</label>
            <div class="currency-input-wrap">
              <span class="currency-prefix">Rp</span>
              <input id="wishPrice" class="form-control num" type="text" inputmode="numeric" autocomplete="off" required placeholder="500.000" value="${existing ? escapeHtml(CurrencyFormat.formatForInput(existing.price, 'IDR')) : ''}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="wishPriority">Prioritas</label>
            <select id="wishPriority" class="form-control">
              <option value="high" ${existing && existing.priority === 'high' ? 'selected' : ''}>Tinggi</option>
              <option value="medium" ${!existing || existing.priority === 'medium' ? 'selected' : ''}>Sedang</option>
              <option value="low" ${existing && existing.priority === 'low' ? 'selected' : ''}>Rendah</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="wishCategory">Kategori</label>
          <select id="wishCategory" class="form-control">
            ${EXPENSE_CATEGORIES.map((c) => `<option value="${escapeHtml(c.name)}" ${existing && existing.category === c.name ? 'selected' : ''}>${c.icon} ${escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="wishNote">Catatan / Tautan</label>
          <textarea id="wishNote" class="form-control" placeholder="Contoh: Cek promo akhir bulan">${existing ? escapeHtml(existing.note) : ''}</textarea>
        </div>
        <button type="submit" class="btn btn-primary btn-full md-ripple">${existing ? 'Simpan Perubahan' : 'Tambahkan ke Wishlist'}</button>
      </form>
    `;

    this.openModal(existing ? 'Edit Wishlist' : 'Tambah Wishlist', html);

    const sheet = document.getElementById('modalSheet');
    CurrencyFormat.attachInput(sheet.querySelector('#wishPrice'), 'IDR');

    sheet.querySelector('#wishForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const now = new Date().toISOString();
      const data = {
        name: sheet.querySelector('#wishName').value.trim(),
        price: CurrencyFormat.parseInput(sheet.querySelector('#wishPrice').value, 'IDR'),
        priority: sheet.querySelector('#wishPriority').value,
        category: sheet.querySelector('#wishCategory').value,
        note: sheet.querySelector('#wishNote').value.trim()
      };

      if (existing) {
        Object.assign(existing, data, { updatedAt: now, syncStatus: 'pending' });
      } else {
        Store.state.wishlist.push(Object.assign({
          id: uid('wish'),
          status: 'pending',
          updatedAt: now,
          deleted: false,
          syncStatus: 'pending'
        }, data));
      }

      this.haptic(12);
      Store.save();
      this.scheduleAutoSync();
      this.closeModal();
      this.showToast(existing ? 'Wishlist diperbarui' : 'Wishlist ditambahkan');
    });
  },

  fulfillWishlist(wishId) {
    const item = Store.state.wishlist.find((w) => w.id === wishId);
    if (!item) return;

    this.openConfirmSheet({
      title: 'Beli & Catat Pengeluaran?',
      message: `"${item.name}" (${formatRpFull(item.price)}) akan ditandai tercapai dan otomatis dicatat ke pengeluaran hari ini.`,
      confirmText: 'Ya, Catat',
      confirmClass: 'btn-primary',
      onConfirm: () => {
        const now = new Date().toISOString();
        item.status = 'achieved';
        item.updatedAt = now;
        item.syncStatus = 'pending';

        Store.state.transactions.push({
          id: uid('tx'),
          date: todayIso(),
          type: 'expense',
          category: item.category || 'Belanja',
          amount: Number(item.price) || 0,
          currency: 'IDR',
          originalAmount: Number(item.price) || 0,
          exchangeRate: 1,
          method: 'Transfer Bank',
          note: `Wishlist tercapai: ${item.name}`,
          updatedAt: now,
          deleted: false,
          syncStatus: 'pending'
        });

        this.haptic(12);
        Store.save();
        this.scheduleAutoSync();
        this.showToast(`"${item.name}" dicatat sebagai pengeluaran!`);
      }
    });
  },

  deleteWishlist(wishId) {
    const item = Store.state.wishlist.find((w) => w.id === wishId);
    if (!item) return;

    this.openConfirmSheet({
      title: 'Hapus Wishlist?',
      message: `Item "${item.name}" akan dihapus dari daftar wishlist Anda.`,
      confirmText: 'Ya, Hapus',
      onConfirm: () => {
        item.deleted = true;
        item.updatedAt = new Date().toISOString();
        item.syncStatus = 'pending';
        Store.save();
        this.scheduleAutoSync();
        this.showToast('Wishlist dihapus');
      }
    });
  },

  /* ========================================================================
     LAPORAN PDF SEMI-FORMAL (MINGGUAN / BULANAN / TAHUNAN)
     ======================================================================== */
  openPdfExportModal() {
    let period = 'monthly';
    const cur = CurrencyFormat.getDisplayCurrency();
    const owner = Store.state.settings.reportOwner || '';
    const defaultYm = this.getSelectedYM();

    const html = `
      <form id="pdfExportForm">
        <div class="form-group">
          <label class="form-label">Periode Laporan</label>
          <div class="segmented cols-3" id="pdfPeriodSeg">
            <button type="button" class="seg-btn md-ripple" data-period="weekly">Mingguan</button>
            <button type="button" class="seg-btn md-ripple active" data-period="monthly">Bulanan</button>
            <button type="button" class="seg-btn md-ripple" data-period="yearly">Tahunan</button>
          </div>
        </div>

        <div class="form-group" id="pdfWeeklyGroup" style="display:none;">
          <label class="form-label" for="pdfWeekDate">Pilih Tanggal dalam Minggu (Senin – Minggu)</label>
          <input type="date" id="pdfWeekDate" class="form-control" value="${todayIso()}">
        </div>

        <div class="form-group" id="pdfMonthlyGroup">
          <label class="form-label" for="pdfMonthInput">Pilih Bulan & Tahun</label>
          <input type="month" id="pdfMonthInput" class="form-control" value="${defaultYm}">
        </div>

        <div class="form-group" id="pdfYearlyGroup" style="display:none;">
          <label class="form-label" for="pdfYearInput">Pilih Tahun Laporan</label>
          <input type="number" id="pdfYearInput" class="form-control num" min="2000" max="2100" value="${this.selectedYear}">
        </div>

        <div class="row-2">
          <div class="form-group">
            <label class="form-label" for="pdfCurrency">Mata Uang Laporan</label>
            <select id="pdfCurrency" class="form-control">
              <option value="IDR" ${cur === 'IDR' ? 'selected' : ''}>IDR (Rupiah)</option>
              <option value="USD" ${cur === 'USD' ? 'selected' : ''}>USD (Dolar AS)</option>
              <option value="SAR" ${cur === 'SAR' ? 'selected' : ''}>SAR (Riyal Saudi)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="pdfOwner">Nama Pemilik (Opsional)</label>
            <input type="text" id="pdfOwner" class="form-control" placeholder="Nama Anda" value="${escapeHtml(owner)}">
          </div>
        </div>

        <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:14px;cursor:pointer;">
          <input type="checkbox" id="pdfIncludeSavings" checked>
          <span>Sertakan ringkasan saldo Buku Tabungan</span>
        </label>

        <button type="submit" class="btn btn-primary btn-full md-ripple">Cetak PDF</button>
        <p class="helper-text" style="text-align:center;">Pilih "Cetak PDF" untuk generate & cetak.</p>
      </form>
    `;

    this.openModal('Ekspor Laporan PDF', html);

    const sheet = document.getElementById('modalSheet');
    const weeklyG = sheet.querySelector('#pdfWeeklyGroup');
    const monthlyG = sheet.querySelector('#pdfMonthlyGroup');
    const yearlyG = sheet.querySelector('#pdfYearlyGroup');

    sheet.querySelectorAll('#pdfPeriodSeg .seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        period = btn.dataset.period;
        sheet.querySelectorAll('#pdfPeriodSeg .seg-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        weeklyG.style.display = period === 'weekly' ? 'block' : 'none';
        monthlyG.style.display = period === 'monthly' ? 'block' : 'none';
        yearlyG.style.display = period === 'yearly' ? 'block' : 'none';
      });
    });

    sheet.querySelector('#pdfExportForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const reportCurrency = sheet.querySelector('#pdfCurrency').value;
      const reportOwner = sheet.querySelector('#pdfOwner').value.trim();
      const includeSavings = sheet.querySelector('#pdfIncludeSavings').checked;

      Store.state.settings.reportOwner = reportOwner;
      Store.save();

      let startDate = '';
      let endDate = '';
      let periodTitle = '';
      let periodLabel = '';

      if (period === 'weekly') {
        const refVal = sheet.querySelector('#pdfWeekDate').value || todayIso();
        const ref = new Date(refVal + 'T00:00:00');
        const dow = ref.getDay();
        const diffToMon = dow === 0 ? -6 : 1 - dow;
        const mon = new Date(ref);
        mon.setDate(ref.getDate() + diffToMon);
        const sun = new Date(mon);
        sun.setDate(mon.getDate() + 6);
        const fmtIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        startDate = fmtIso(mon);
        endDate = fmtIso(sun);
        periodTitle = 'LAPORAN TRANSAKSI MINGGUAN';
        periodLabel = `${this.formatDateHuman(startDate)} s.d. ${this.formatDateHuman(endDate)}`;
      } else if (period === 'monthly') {
        const ymVal = sheet.querySelector('#pdfMonthInput').value || defaultYm;
        const [y, m] = ymVal.split('-').map(Number);
        const lastDay = new Date(y, m, 0).getDate();
        startDate = `${ymVal}-01`;
        endDate = `${ymVal}-${String(lastDay).padStart(2, '0')}`;
        periodTitle = 'LAPORAN TRANSAKSI BULANAN';
        periodLabel = `${MONTH_FULL[m - 1]} ${y}`;
      } else {
        const y = Number(sheet.querySelector('#pdfYearInput').value) || this.selectedYear;
        startDate = `${y}-01-01`;
        endDate = `${y}-12-31`;
        periodTitle = 'LAPORAN TRANSAKSI TAHUNAN';
        periodLabel = `Tahun ${y}`;
      }

      const filteredTx = this.getActiveTransactions()
        .filter((t) => t.date >= startDate && t.date <= endDate)
        .sort((a, b) => a.date.localeCompare(b.date));

      this.closeModal();
      this.generateAndPrintPdf({
        periodTitle,
        periodLabel,
        reportCurrency,
        reportOwner,
        includeSavings,
        transactions: filteredTx
      });
    });
  },

  generateAndPrintPdf({ periodTitle, periodLabel, reportCurrency, reportOwner, includeSavings, transactions }) {
    const fmt = (idr) => CurrencyFormat.formatMoney(idr, reportCurrency);
    const totalIncome = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const totalExpense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const netCashflow = totalIncome - totalExpense;
    const saveRate = totalIncome > 0 ? Math.round((netCashflow / totalIncome) * 100) : 0;
    const rates = CurrencyFormat.getRates();
    const printedAt = new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });

    // Ringkasan pengeluaran per kategori
    const catMap = new Map();
    transactions.filter((t) => t.type === 'expense').forEach((t) => {
      catMap.set(t.category, (catMap.get(t.category) || 0) + Number(t.amount));
    });
    const catRows = Array.from(catMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => {
        const pct = totalExpense > 0 ? ((amt / totalExpense) * 100).toFixed(1) : '0.0';
        return `
          <tr>
            <td>${escapeHtml(cat)}</td>
            <td class="right num">${fmt(amt)}</td>
            <td class="right num">${pct}%</td>
          </tr>
        `;
      }).join('');

    const txRows = transactions.length
      ? transactions.map((t, i) => {
        const isInc = t.type === 'income';
        const fxTag = (t.currency && t.currency !== 'IDR' && t.originalAmount)
          ? ` <span class="muted">(${escapeHtml(CurrencyFormat.formatOriginal(t.originalAmount, t.currency))})</span>`
          : '';
        return `
            <tr>
              <td class="center num">${i + 1}</td>
              <td class="nowrap">${escapeHtml(this.formatDateHuman(t.date))}</td>
              <td><strong>${escapeHtml(t.category)}</strong></td>
              <td>${escapeHtml(t.method || 'Tunai')}</td>
              <td>${escapeHtml(t.note || '—')}${fxTag}</td>
              <td class="right num inc">${isInc ? fmt(t.amount) : '—'}</td>
              <td class="right num exp">${!isInc ? fmt(t.amount) : '—'}</td>
            </tr>
          `;
      }).join('')
      : '<tr><td colspan="7" class="center muted" style="padding:18px;">Tidak terdapat transaksi pada periode ini.</td></tr>';

    const books = Store.state.savingsBooks.filter((b) => !b.deleted);
    const totalSavings = books.reduce((s, b) => s + Number(b.balance || 0), 0);
    const savingsSection = includeSavings && books.length ? `
      <div class="section">
        <h3>Ringkasan Buku Tabungan</h3>
        <table>
          <thead>
            <tr>
              <th>Nama Buku Tabungan</th>
              <th>Keterangan</th>
              <th class="right">Saldo Saat Ini</th>
              <th class="right">Target</th>
            </tr>
          </thead>
          <tbody>
            ${books.map((b) => `
              <tr>
                <td><strong>${escapeHtml(b.name)}</strong></td>
                <td>${escapeHtml(b.note || '—')}</td>
                <td class="right num">${fmt(b.balance)}</td>
                <td class="right num">${fmt(b.target)}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="2">Total Saldo Tabungan</td>
              <td class="right num">${fmt(totalSavings)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    ` : '';

    const docHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(periodTitle)} - ${escapeHtml(periodLabel)}</title>
  <style>
    @page { size: A4 portrait; margin: 16mm 15mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Plus Jakarta Sans', 'Segoe UI', Arial, sans-serif;
      color: #161D1C;
      margin: 0;
      font-size: 11px;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #006A60;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .brand { display: flex; align-items: center; gap: 10px; }
    .logo {
      width: 34px; height: 34px; border-radius: 9px;
      background: #006A60; color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 17px;
    }
    .brand-name { font-size: 16px; font-weight: 800; margin: 0; color: #006A60; }
    .brand-sub { font-size: 10px; color: #52606D; margin: 1px 0 0; }
    .doc-meta { text-align: right; }
    .doc-title { font-size: 14px; font-weight: 800; margin: 0; letter-spacing: 0.02em; }
    .doc-period { font-size: 11px; font-weight: 700; color: #006A60; margin-top: 2px; }
    .doc-info { font-size: 9.5px; color: #52606D; margin-top: 3px; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 18px;
    }
    .sum-box {
      border: 1px solid #D5DBD9;
      background: #F4FBF8;
      border-radius: 10px;
      padding: 10px 12px;
    }
    .sum-label { font-size: 9.5px; color: #52606D; font-weight: 600; margin-bottom: 3px; }
    .sum-val { font-size: 13px; font-weight: 800; }
    .inc { color: #006E47; }
    .exp { color: #BA1A1A; }
    .muted { color: #6F7977; }
    .num { font-variant-numeric: tabular-nums; }
    .section { margin-bottom: 18px; }
    h3 {
      font-size: 12px;
      font-weight: 800;
      margin: 0 0 8px;
      padding-left: 8px;
      border-left: 3px solid #006A60;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    table { width: 100%; border-collapse: collapse; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
    th {
      background: #E9EFEC;
      color: #161D1C;
      font-weight: 700;
      text-align: left;
      padding: 7px 8px;
      border-top: 1px solid #BEC9C6;
      border-bottom: 1px solid #BEC9C6;
      font-size: 10px;
    }
    td {
      padding: 6.5px 8px;
      border-bottom: 1px solid #E3EAE7;
      vertical-align: top;
    }
    .right { text-align: right; }
    .center { text-align: center; }
    .nowrap { white-space: nowrap; }
    .total-row td {
      font-weight: 800;
      background: #F4FBF8;
      border-top: 1.5px solid #006A60;
      border-bottom: 1.5px solid #006A60;
    }
    .footer {
      margin-top: 22px;
      padding-top: 10px;
      border-top: 1px solid #D5DBD9;
      display: flex;
      justify-content: space-between;
      font-size: 9.5px;
      color: #6F7977;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <div class="logo">S</div>
      <div>
        <div class="brand-name">SakuKu Finance</div>
        <div class="brand-sub">Laporan Keuangan Pribadi Semi-Formal</div>
      </div>
    </div>
    <div class="doc-meta">
      <div class="doc-title">${escapeHtml(periodTitle)}</div>
      <div class="doc-period">${escapeHtml(periodLabel)}</div>
      <div class="doc-info">
        ${reportOwner ? `Pemilik: <strong>${escapeHtml(reportOwner)}</strong> · ` : ''}
        Mata Uang: <strong>${escapeHtml(reportCurrency)}</strong>
        ${reportCurrency !== 'IDR' ? ` (1 ${reportCurrency} = Rp ${Math.round(rates[reportCurrency]).toLocaleString('id-ID')})` : ''}
      </div>
    </div>
  </div>

  <div class="summary-grid">
    <div class="sum-box">
      <div class="sum-label">Total Pemasukan</div>
      <div class="sum-val num inc">${fmt(totalIncome)}</div>
    </div>
    <div class="sum-box">
      <div class="sum-label">Total Pengeluaran</div>
      <div class="sum-val num exp">${fmt(totalExpense)}</div>
    </div>
    <div class="sum-box">
      <div class="sum-label">Arus Kas Bersih</div>
      <div class="sum-val num ${netCashflow >= 0 ? 'inc' : 'exp'}">${netCashflow >= 0 ? '+' : ''}${fmt(netCashflow)}</div>
    </div>
    <div class="sum-box">
      <div class="sum-label">Rasio Sisa / Transaksi</div>
      <div class="sum-val num">${saveRate}% · ${transactions.length} Tx</div>
    </div>
  </div>

  ${catRows ? `
    <div class="section">
      <h3>Ringkasan Pengeluaran per Kategori</h3>
      <table>
        <thead>
          <tr>
            <th>Kategori</th>
            <th class="right">Total Pengeluaran</th>
            <th class="right">Proporsi</th>
          </tr>
        </thead>
        <tbody>
          ${catRows}
          <tr class="total-row">
            <td>Total Pengeluaran</td>
            <td class="right num">${fmt(totalExpense)}</td>
            <td class="right num">100%</td>
          </tr>
        </tbody>
      </table>
    </div>
  ` : ''}

  <div class="section">
    <h3>Rincian Transaksi</h3>
    <table>
      <thead>
        <tr>
          <th class="center" style="width:28px;">No</th>
          <th>Tanggal</th>
          <th>Kategori</th>
          <th>Metode</th>
          <th>Keterangan</th>
          <th class="right">Pemasukan</th>
          <th class="right">Pengeluaran</th>
        </tr>
      </thead>
      <tbody>
        ${txRows}
        <tr class="total-row">
          <td colspan="5">Jumlah Keseluruhan (${transactions.length} Transaksi)</td>
          <td class="right num inc">${fmt(totalIncome)}</td>
          <td class="right num exp">${fmt(totalExpense)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  ${savingsSection}

  <div class="footer">
    <span>Dicetak melalui SakuKu pada ${escapeHtml(printedAt)}</span>
    <span>Dokumen ini dihasilkan secara otomatis dari catatan keuangan SakuKu.</span>
  </div>
</body>
</html>`;

    // Cetak menggunakan hidden iframe (bebas popup blocker & 100% offline-ready)
    let iframe = document.getElementById('sakukuPrintFrame');
    if (iframe) iframe.remove();
    iframe = document.createElement('iframe');
    iframe.id = 'sakukuPrintFrame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const frameDoc = iframe.contentWindow.document;
    frameDoc.open();
    frameDoc.write(docHtml);
    frameDoc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }, 280);
  },

  /* ========================================================================
     MODAL: PENGATURAN, MONET OTOMATIS, KURS REAL-TIME & CLOUD SYNC
     ======================================================================== */
  formatDateTimeShort(isoStr) {
    if (!isoStr) return '-';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '-';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  },

  refreshSettingsModalInPlace() {
    const root = document.getElementById('settingsModalRoot');
    if (!root) return;
    const s = Store.state.settings;
    const pending = Store.getPendingCount();
    const rates = CurrencyFormat.getRates();

    const netEl = root.querySelector('#settingsNetStatus');
    if (netEl) {
      netEl.textContent = navigator.onLine ? 'Online' : 'Offline';
      netEl.style.color = navigator.onLine ? 'var(--income)' : 'var(--expense)';
    }

    const pendingEl = root.querySelector('#settingsPendingCount');
    if (pendingEl) pendingEl.textContent = `${pending} perubahan`;

    const lastSyncKv = root.querySelector('#settingsLastSyncKv');
    if (lastSyncKv) {
      lastSyncKv.textContent = s.lastSyncAt
        ? new Date(s.lastSyncAt).toLocaleString('id-ID')
        : 'Belum pernah';
    }

    const ratesKv = root.querySelector('#settingsRatesKv');
    if (ratesKv) {
      ratesKv.innerHTML = `1 USD = Rp ${Math.round(rates.USD).toLocaleString('id-ID')} <br> 1 SAR = Rp ${Math.round(rates.SAR).toLocaleString('id-ID')}`;
    }

    const lastSyncTime = root.querySelector('#settingsLastSyncTime');
    if (lastSyncTime) lastSyncTime.textContent = this.formatDateTimeShort(s.lastSyncAt);

    const rateUpdatedTime = root.querySelector('#settingsRateUpdatedTime');
    if (rateUpdatedTime) rateUpdatedTime.textContent = this.formatDateTimeShort(rates.updatedAt);

    const themeMode = s.themeMode || 'system';
    root.querySelectorAll('#themeModeSeg .seg-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === themeMode);
    });
  },

  openSettingsModal() {
    const s = Store.state.settings;
    const pending = Store.getPendingCount();
    const lastSyncText = s.lastSyncAt
      ? new Date(s.lastSyncAt).toLocaleString('id-ID')
      : 'Belum pernah';
    const lastSyncShort = this.formatDateTimeShort(s.lastSyncAt);
    const rates = CurrencyFormat.getRates();
    const rateUpdatedShort = this.formatDateTimeShort(rates.updatedAt);
    const themeMode = s.themeMode || 'system';
    const monetStatus = this.monetInfo && this.monetInfo.source === 'device'
      ? 'Aktif (Mengikuti Aksen Perangkat)'
      : 'Aktif (Adaptif Tema Perangkat)';

    const html = `
      <div id="settingsModalRoot">
      <div class="detail-kv-list">
        <div class="detail-kv">
          <span class="detail-kv-label">Status Jaringan</span>
          <span class="detail-kv-val" id="settingsNetStatus" style="color:${navigator.onLine ? 'var(--income)' : 'var(--expense)'};">${navigator.onLine ? 'Online' : 'Offline'}</span>
        </div>
        <div class="detail-kv">
          <span class="detail-kv-label">Antrean Cloud</span>
          <span class="detail-kv-val num" id="settingsPendingCount">${pending} perubahan</span>
        </div>
        <div class="detail-kv">
          <span class="detail-kv-label">Sync Terakhir</span>
          <span class="detail-kv-val" id="settingsLastSyncKv">${escapeHtml(lastSyncText)}</span>
        </div>
        <div class="detail-kv">
          <span class="detail-kv-label">Kurs Real-Time</span>
          <span class="detail-kv-val num" id="settingsRatesKv">1 USD = Rp ${Math.round(rates.USD).toLocaleString('id-ID')} <br> 1 SAR = Rp ${Math.round(rates.SAR).toLocaleString('id-ID')}</span>
        </div>
      </div>

      ${Store.isGasEmbedded() ? `
        <div class="form-group">
          <div class="helper-text" style="color:var(--income);font-weight:700;">Terhubung langsung ke Google Apps Script (Mode Embedded).</div>
        </div>
      ` : `
        <div class="form-group">
          <label class="form-label" for="gasUrlInput">URL Web App Google Apps Script</label>
          <input id="gasUrlInput" class="form-control" type="url" placeholder="https://script.google.com/macros/s/.../exec" value="${escapeHtml(s.gasUrl || '')}">
        </div>
      `}

      <div class="row-2" style="margin-bottom:14px;align-items:start;">
        <div class="sync-action-col">
          <button type="button" class="btn btn-primary btn-sm btn-full md-ripple" id="saveAndSyncBtn">Sinkronkan Cloud</button>
          <div class="action-timestamp num" id="settingsLastSyncTime">${escapeHtml(lastSyncShort)}</div>
        </div>
        <div class="sync-action-col">
          <button type="button" class="btn btn-tonal btn-sm btn-full md-ripple" id="refreshRatesBtn">Perbarui Kurs</button>
          <div class="action-timestamp num" id="settingsRateUpdatedTime">${escapeHtml(rateUpdatedShort)}</div>
        </div>
      </div>

      <div class="form-group" style="border-top:1px solid var(--md-sys-color-outline-variant);padding-top:12px;">
        <label class="form-label">Tema Aplikasi</label>
        <div class="segmented cols-3" id="themeModeSeg">
          <button type="button" class="seg-btn md-ripple ${themeMode === 'system' ? 'active' : ''}" data-mode="system">Otomatis</button>
          <button type="button" class="seg-btn md-ripple ${themeMode === 'light' ? 'active' : ''}" data-mode="light">Terang</button>
          <button type="button" class="seg-btn md-ripple ${themeMode === 'dark' ? 'active' : ''}" data-mode="dark">Gelap</button>
        </div>
        <!-- <div class="helper-text">Monet Dinamis: <strong>${escapeHtml(monetStatus)}</strong></div> -->
      </div>

      <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px;">
        <button type="button" class="btn btn-tonal btn-full btn-sm md-ripple" id="settingsExportPdfBtn">📄 Ekspor Laporan PDF </button>
        <div class="row-2">
          <button type="button" class="btn btn-secondary btn-sm md-ripple" id="exportCsvBtn">Export CSV</button>
          <button type="button" class="btn btn-secondary btn-sm md-ripple" id="exportJsonBtn">Backup JSON</button>
        </div>
      </div>
      </div>
    `;

    this.openModal('Pengaturan & Cloud Sync', html);

    const sheet = document.getElementById('modalSheet');

    sheet.querySelectorAll('#themeModeSeg .seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        Store.state.settings.themeMode = btn.dataset.mode;
        Store.save({ silent: true });
        this.applyTheme();
        this.refreshSettingsModalInPlace();
      });
    });

    sheet.querySelector('#refreshRatesBtn').addEventListener('click', async () => {
      if (!navigator.onLine) {
        this.showToast('Offline — menggunakan kurs tersimpan terakhir');
        return;
      }
      this.showToast('Mengambil kurs real-time USD & SAR...');
      const res = await ExchangeService.fetchLiveRates(true);
      if (res.ok) {
        this.showToast(`Kurs diperbarui: 1 USD = Rp ${Math.round(res.rates.USD).toLocaleString('id-ID')}`);
        this.refreshSettingsModalInPlace();
      } else {
        this.showToast('Gagal mengambil kurs — memakai kurs cache');
      }
    });

    sheet.querySelector('#saveAndSyncBtn').addEventListener('click', async () => {
      const urlInput = sheet.querySelector('#gasUrlInput');
      if (urlInput) {
        Store.state.settings.gasUrl = urlInput.value.trim();
        Store.save({ silent: true });
        this.updateSyncPill();
      }

      if (!navigator.onLine) {
        this.showToast('Perangkat offline — sync otomatis saat online');
        return;
      }

      if (!Store.canSync()) {
        this.showToast('Masukkan URL Web App Google Apps Script dulu');
        return;
      }

      this.showToast('Menyinkronkan ke Google Sheets...');
      const res = await Store.syncNow();
      if (res.ok) {
        this.showToast('Berhasil sinkronisasi dengan Google Sheets!');
        this.refreshSettingsModalInPlace();
      } else {
        this.showToast('Gagal sync: ' + (res.error || 'Periksa URL & izin Web App'));
      }
    });

    sheet.querySelector('#settingsExportPdfBtn').addEventListener('click', () => this.openPdfExportModal());
    sheet.querySelector('#exportCsvBtn').addEventListener('click', () => this.exportCsv());
    sheet.querySelector('#exportJsonBtn').addEventListener('click', () => this.exportJson());
  },

  exportCsv() {
    const rows = [['Tanggal', 'Tipe', 'Kategori', 'Nominal_IDR', 'MataUang', 'Nominal_Asli', 'Kurs', 'Metode', 'Catatan']];
    this.getActiveTransactions().forEach((t) => {
      rows.push([
        t.date,
        t.type,
        t.category,
        t.amount,
        t.currency || 'IDR',
        t.originalAmount || t.amount,
        t.exchangeRate || 1,
        t.method,
        `"${String(t.note || '').replace(/"/g, '""')}"`
      ]);
    });
    const csv = rows.map((r) => r.join(',')).join('\n');
    this.downloadFile(`sakuku-transaksi-${todayIso()}.csv`, csv, 'text/csv;charset=utf-8;');
    this.showToast('File CSV diunduh');
  },

  exportJson() {
    const json = JSON.stringify(Store.state, null, 2);
    this.downloadFile(`sakuku-backup-${todayIso()}.json`, json, 'application/json');
    this.showToast('Backup JSON diunduh');
  },

  downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
