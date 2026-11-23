/**
 * SakuKu - Pencatatan Keuangan Harian
 * Backend Google Apps Script + Database Google Spreadsheets
 *
 * Mendukung:
 * 1. REST API JSON (untuk PWA Offline-First via GitHub Pages / Netlify / Vercel)
 * 2. HtmlService Web App (langsung dibuka dari URL Google Apps Script, edge-to-edge)
 * 3. Multi-Mata Uang (IDR, USD, SAR) + Proxy Kurs Real-Time dengan CacheService (6 jam)
 */

const SHEET_NAMES = {
  TRANSACTIONS: 'Transaksi',
  SAVINGS_BOOKS: 'BukuTabungan',
  SAVINGS_LEDGER: 'MutasiTabungan',
  WISHLIST: 'Wishlist'
};

const HEADERS = {
  TRANSACTIONS: [
    'ID', 'Tanggal', 'Tipe', 'Kategori', 'Nominal',
    'Metode', 'Catatan', 'UpdatedAt', 'Deleted',
    'MataUang', 'NominalAsli', 'Kurs'
  ],
  SAVINGS_BOOKS: [
    'ID', 'NamaBuku', 'Target', 'Saldo', 'Warna',
    'Catatan', 'UpdatedAt', 'Deleted'
  ],
  SAVINGS_LEDGER: [
    'ID', 'BukuID', 'Tanggal', 'Tipe', 'Nominal',
    'SaldoAkhir', 'Catatan', 'UpdatedAt', 'Deleted'
  ],
  WISHLIST: [
    'ID', 'NamaItem', 'Harga', 'Prioritas', 'Kategori',
    'Status', 'Catatan', 'UpdatedAt', 'Deleted'
  ]
};

/**
 * Menambahkan menu kustom di Google Spreadsheets
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('SakuKu Finance')
    .addItem('Inisialisasi / Cek Tabel Database', 'setupDatabase')
    .addItem('Cek Kurs Real-Time (USD & SAR)', 'testExchangeRates')
    .addToUi();
}

/**
 * Membuat seluruh sheet database & migrasi kolom baru secara otomatis tanpa menghapus data lama
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  Object.keys(SHEET_NAMES).forEach(function (key) {
    const sheetName = SHEET_NAMES[key];
    const headers = HEADERS[key];
    let sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#006A60');
      headerRange.setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);
    } else {
      // Migrasi otomatis: tambahkan kolom baru jika sheet lama belum memiliki header lengkap
      const currentCols = sheet.getLastColumn();
      if (currentCols < headers.length) {
        const missingHeaders = headers.slice(currentCols);
        const newHeaderRange = sheet.getRange(1, currentCols + 1, 1, missingHeaders.length);
        newHeaderRange.setValues([missingHeaders]);
        newHeaderRange.setFontWeight('bold');
        newHeaderRange.setBackground('#006A60');
        newHeaderRange.setFontColor('#FFFFFF');
      }
    }

    // Format kolom nominal sesuai standar mata uang
    if (sheetName === SHEET_NAMES.TRANSACTIONS) {
      sheet.getRange('E2:E').setNumberFormat('#,##0');
      sheet.getRange('K2:L').setNumberFormat('#,##0.##');
    } else if (sheetName === SHEET_NAMES.SAVINGS_BOOKS) {
      sheet.getRange('C2:D').setNumberFormat('#,##0');
    } else if (sheetName === SHEET_NAMES.SAVINGS_LEDGER) {
      sheet.getRange('E2:F').setNumberFormat('#,##0');
    } else if (sheetName === SHEET_NAMES.WISHLIST) {
      sheet.getRange('C2:C').setNumberFormat('#,##0');
    }
  });

  // Hapus sheet default "Sheet1" jika masih kosong dan bukan satu-satunya sheet
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1 && defaultSheet.getLastRow() === 0) {
    ss.deleteSheet(defaultSheet);
  }

  return { ok: true, message: 'Database SakuKu siap digunakan.' };
}

/**
 * Mengambil kurs real-time USD & SAR terhadap IDR (di-cache 6 jam di CacheService)
 * Dapat dipanggil via ?action=rates atau google.script.run.getExchangeRates()
 */
function getExchangeRates() {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'sakuku_fx_rates_v1';
  const cached = cache.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {}
  }

  try {
    const res = UrlFetchApp.fetch('https://open.er-api.com/v6/latest/IDR', { muteHttpExceptions: true });
    if (res.getResponseCode() === 200) {
      const json = JSON.parse(res.getContentText());
      if (json && json.rates && json.rates.USD && json.rates.SAR) {
        const result = {
          ok: true,
          IDR: 1,
          USD: Math.round(1 / json.rates.USD),
          SAR: Math.round(1 / json.rates.SAR),
          updatedAt: new Date().toISOString(),
          source: 'live'
        };
        cache.put(cacheKey, JSON.stringify(result), 21600); // 6 jam
        return result;
      }
    }
  } catch (err) {
    // fallback ke kurs standar jika jaringan gagal
  }

  return {
    ok: false,
    IDR: 1,
    USD: 16200,
    SAR: 4320,
    updatedAt: new Date().toISOString(),
    source: 'default'
  };
}

function testExchangeRates() {
  const r = getExchangeRates();
  SpreadsheetApp.getUi().alert(
    'Kurs SakuKu (' + r.source + ')\n' +
    '1 USD = Rp ' + r.USD + '\n' +
    '1 SAR = Rp ' + r.SAR
  );
}

/**
 * Handler GET:
 * - ?action=sync atau ?api=1 -> Mengembalikan seluruh data JSON
 * - ?action=rates -> Mengembalikan kurs real-time USD & SAR
 * - Tanpa parameter -> Menampilkan antarmuka HtmlService (Index.html)
 */
function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};

  if (params.action === 'rates') {
    return createJsonResponse(getExchangeRates());
  }

  if (params.action === 'sync' || params.api === '1') {
    try {
      setupDatabase();
      const data = getAllData();
      return createJsonResponse({
        ok: true,
        serverTime: new Date().toISOString(),
        data: data
      });
    } catch (err) {
      return createJsonResponse({ ok: false, error: err.message });
    }
  }

  // Fallback: sajikan aplikasi web langsung dari GAS jika file Index.html tersedia
  try {
    return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('SakuKu - Pencatatan Keuangan')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return createJsonResponse({
      ok: true,
      message: 'API SakuKu aktif. Gunakan ?api=1 untuk mengambil data atau hubungkan ke PWA.'
    });
  }
}

/**
 * Handler POST:
 * Menerima batch sinkronisasi dari aplikasi offline (PWA / HtmlService)
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    setupDatabase();

    const rawBody = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    const payload = JSON.parse(rawBody);
    const result = processSyncPayload(payload);

    return createJsonResponse(result);
  } catch (err) {
    return createJsonResponse({ ok: false, error: err.message });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Fungsi yang dapat dipanggil langsung oleh google.script.run (Mode HtmlService)
 */
function syncFromClient(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    setupDatabase();
    return processSyncPayload(payload || {});
  } finally {
    lock.releaseLock();
  }
}

/**
 * Memproses sinkronisasi dua arah (Upsert pending changes + Pull latest data)
 */
function processSyncPayload(payload) {
  if (payload.transactions && payload.transactions.length) {
    upsertRows(SHEET_NAMES.TRANSACTIONS, payload.transactions, 7, function (item) {
      const amountIdr = Number(item.amount) || 0;
      const currency = String(item.currency || 'IDR').toUpperCase();
      const origAmt = Number(item.originalAmount) || amountIdr;
      const fxRate = Number(item.exchangeRate) || 1;
      return [
        item.id,
        item.date || '',
        item.type || 'expense',
        item.category || 'Lainnya',
        amountIdr,
        item.method || 'Tunai',
        item.note || '',
        item.updatedAt || new Date().toISOString(),
        item.deleted ? 'TRUE' : 'FALSE',
        currency,
        origAmt,
        fxRate
      ];
    });
  }

  if (payload.savingsBooks && payload.savingsBooks.length) {
    upsertRows(SHEET_NAMES.SAVINGS_BOOKS, payload.savingsBooks, 6, function (item) {
      return [
        item.id,
        item.name || 'Tabungan',
        Number(item.target) || 0,
        Number(item.balance) || 0,
        item.color || '#006A60',
        item.note || '',
        item.updatedAt || new Date().toISOString(),
        item.deleted ? 'TRUE' : 'FALSE'
      ];
    });
  }

  if (payload.savingsLedger && payload.savingsLedger.length) {
    upsertRows(SHEET_NAMES.SAVINGS_LEDGER, payload.savingsLedger, 7, function (item) {
      return [
        item.id,
        item.bookId || '',
        item.date || '',
        item.type || 'deposit',
        Number(item.amount) || 0,
        Number(item.balanceAfter) || 0,
        item.note || '',
        item.updatedAt || new Date().toISOString(),
        item.deleted ? 'TRUE' : 'FALSE'
      ];
    });
  }

  if (payload.wishlist && payload.wishlist.length) {
    upsertRows(SHEET_NAMES.WISHLIST, payload.wishlist, 7, function (item) {
      return [
        item.id,
        item.name || '',
        Number(item.price) || 0,
        item.priority || 'medium',
        item.category || 'Lainnya',
        item.status || 'pending',
        item.note || '',
        item.updatedAt || new Date().toISOString(),
        item.deleted ? 'TRUE' : 'FALSE'
      ];
    });
  }

  return {
    ok: true,
    serverTime: new Date().toISOString(),
    data: getAllData()
  };
}

/**
 * Upsert baris berdasarkan ID (kolom A) dengan resolusi Last-Write-Wins berdasarkan indeks kolom UpdatedAt
 */
function upsertRows(sheetName, items, updatedAtColIdx, rowMapper) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  const lastRow = sheet.getLastRow();
  const numCols = sheet.getLastColumn();

  const existingIndex = {};
  if (lastRow > 1) {
    const existingData = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();
    for (let i = 0; i < existingData.length; i++) {
      const id = String(existingData[i][0]);
      const updatedAt = formatIsoValue(existingData[i][updatedAtColIdx]);
      if (id) {
        existingIndex[id] = { rowNum: i + 2, updatedAt: updatedAt };
      }
    }
  }

  const rowsToAppend = [];

  items.forEach(function (item) {
    if (!item || !item.id) return;
    const rowValues = rowMapper(item);
    const existing = existingIndex[String(item.id)];

    if (existing) {
      if (!existing.updatedAt || String(item.updatedAt || '') >= existing.updatedAt) {
        sheet.getRange(existing.rowNum, 1, 1, rowValues.length).setValues([rowValues]);
      }
    } else {
      rowsToAppend.push(rowValues);
    }
  });

  if (rowsToAppend.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, rowsToAppend[0].length)
      .setValues(rowsToAppend);
  }
}

/**
 * Membaca seluruh data dari Google Spreadsheets
 */
function getAllData() {
  return {
    transactions: readSheet(SHEET_NAMES.TRANSACTIONS, function (r) {
      const amt = Number(r[4]) || 0;
      const cur = r[9] ? String(r[9]).toUpperCase() : 'IDR';
      const origAmt = (r[10] !== '' && r[10] != null) ? Number(r[10]) : amt;
      const rate = (r[11] !== '' && r[11] != null) ? Number(r[11]) : 1;
      return {
        id: String(r[0]),
        date: formatDateValue(r[1]),
        type: String(r[2] || 'expense'),
        category: String(r[3] || 'Lainnya'),
        amount: amt,
        method: String(r[5] || 'Tunai'),
        note: String(r[6] || ''),
        updatedAt: formatIsoValue(r[7]),
        deleted: parseBool(r[8]),
        currency: cur,
        originalAmount: origAmt,
        exchangeRate: rate,
        syncStatus: 'synced'
      };
    }),
    savingsBooks: readSheet(SHEET_NAMES.SAVINGS_BOOKS, function (r) {
      return {
        id: String(r[0]),
        name: String(r[1] || 'Tabungan'),
        target: Number(r[2]) || 0,
        balance: Number(r[3]) || 0,
        color: String(r[4] || '#006A60'),
        note: String(r[5] || ''),
        updatedAt: formatIsoValue(r[6]),
        deleted: parseBool(r[7]),
        syncStatus: 'synced'
      };
    }),
    savingsLedger: readSheet(SHEET_NAMES.SAVINGS_LEDGER, function (r) {
      return {
        id: String(r[0]),
        bookId: String(r[1] || ''),
        date: formatDateValue(r[2]),
        type: String(r[3] || 'deposit'),
        amount: Number(r[4]) || 0,
        balanceAfter: Number(r[5]) || 0,
        note: String(r[6] || ''),
        updatedAt: formatIsoValue(r[7]),
        deleted: parseBool(r[8]),
        syncStatus: 'synced'
      };
    }),
    wishlist: readSheet(SHEET_NAMES.WISHLIST, function (r) {
      return {
        id: String(r[0]),
        name: String(r[1] || ''),
        price: Number(r[2]) || 0,
        priority: String(r[3] || 'medium'),
        category: String(r[4] || 'Lainnya'),
        status: String(r[5] || 'pending'),
        note: String(r[6] || ''),
        updatedAt: formatIsoValue(r[7]),
        deleted: parseBool(r[8]),
        syncStatus: 'synced'
      };
    })
  };
}

function readSheet(sheetName, mapper) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() <= 1) return [];

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  const results = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i][0]) {
      results.push(mapper(values[i]));
    }
  }
  return results;
}

function formatDateValue(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(val);
}

function formatIsoValue(val) {
  if (!val) return '';
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function parseBool(val) {
  return val === true || String(val).toUpperCase() === 'TRUE';
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
