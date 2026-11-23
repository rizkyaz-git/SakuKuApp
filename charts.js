/**
 * SakuKu Interactive Charts (100% Offline-Ready SVG Charts + M3 Animations)
 * Mendukung konversi mata uang aktif (IDR / USD / SAR) secara otomatis.
 */

const CHART_COLORS = [
  '#006A60', '#006399', '#8A5100', '#BA1A1A',
  '#006E47', '#C2410C', '#0E7490', '#52606D'
];

/**
 * Render Interactive Donut Chart untuk Pengeluaran per Kategori
 */
function renderDonutChart(containerEl, items, totalAmount) {
  if (!containerEl) return;

  if (!items.length || totalAmount <= 0) {
    containerEl.innerHTML = '<div class="empty-state">Belum ada data pengeluaran pada bulan ini.</div>';
    return;
  }

  const radius = 78;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  let activeIndex = -1;

  const slicesHtml = items.map((item, idx) => {
    const color = CHART_COLORS[idx % CHART_COLORS.length];
    const ratio = item.amount / totalAmount;
    const dash = Math.max(ratio * circumference - 2, 2);
    const gap = circumference - dash;
    const currentOffset = offset;
    offset += ratio * circumference;

    return `
      <circle
        class="donut-slice"
        data-idx="${idx}"
        cx="105" cy="105" r="${radius}"
        fill="transparent"
        stroke="${color}"
        stroke-width="${strokeWidth}"
        stroke-dasharray="${dash} ${gap}"
        stroke-dashoffset="${-currentOffset}"
        transform="rotate(-90 105 105)"
        style="cursor:pointer; animation-delay:${idx * 55}ms; transition: stroke-width 0.22s var(--motion-spring), opacity 0.18s ease;"
      />
    `;
  }).join('');

  const legendHtml = items.map((item, idx) => {
    const color = CHART_COLORS[idx % CHART_COLORS.length];
    const pct = Math.round((item.amount / totalAmount) * 100);
    return `
      <button type="button" class="legend-item md-ripple stagger-item" style="--i:${idx};" data-idx="${idx}">
        <span class="legend-left">
          <span class="legend-swatch" style="background:${color}"></span>
          <span class="legend-name">${escapeHtml(item.category)}</span>
        </span>
        <span class="legend-right num">
          <span>${formatRpFull(item.amount)}</span>
          <span class="legend-pct">${pct}%</span>
        </span>
      </button>
    `;
  }).join('');

  containerEl.innerHTML = `
    <div class="donut-wrap">
      <div class="donut-svg-container">
        <svg viewBox="0 0 210 210" width="210" height="210" role="img" aria-label="Diagram Pengeluaran per Kategori">
          <circle cx="105" cy="105" r="${radius}" fill="transparent" stroke="var(--md-sys-color-surface-container-highest)" stroke-width="${strokeWidth}" />
          ${slicesHtml}
        </svg>
        <div class="donut-center">
          <span class="donut-center-label" id="donutCenterLabel">Total Keluar</span>
          <span class="donut-center-value num" id="donutCenterVal">${formatRpShort(totalAmount)}</span>
          <span class="donut-center-pct" id="donutCenterPct">100%</span>
        </div>
      </div>
      <div class="chart-legend">${legendHtml}</div>
    </div>
  `;

  const slices = containerEl.querySelectorAll('.donut-slice');
  const legends = containerEl.querySelectorAll('.legend-item');
  const centerLabel = containerEl.querySelector('#donutCenterLabel');
  const centerVal = containerEl.querySelector('#donutCenterVal');
  const centerPct = containerEl.querySelector('#donutCenterPct');

  function setHighlight(idx) {
    activeIndex = (activeIndex === idx) ? -1 : idx;

    slices.forEach((el, i) => {
      if (activeIndex === -1) {
        el.style.opacity = '1';
        el.setAttribute('stroke-width', String(strokeWidth));
      } else {
        el.style.opacity = (i === activeIndex) ? '1' : '0.28';
        el.setAttribute('stroke-width', i === activeIndex ? String(strokeWidth + 6) : String(strokeWidth));
      }
    });

    legends.forEach((el, i) => {
      el.classList.toggle('active', i === activeIndex);
    });

    if (activeIndex === -1) {
      centerLabel.textContent = 'Total Keluar';
      centerVal.textContent = formatRpShort(totalAmount);
      centerPct.textContent = '100%';
    } else {
      const item = items[activeIndex];
      const pct = Math.round((item.amount / totalAmount) * 100);
      centerLabel.textContent = item.category;
      centerVal.textContent = formatRpShort(item.amount);
      centerPct.textContent = pct + '%';
    }
  }

  slices.forEach((el) => {
    el.addEventListener('click', () => setHighlight(Number(el.dataset.idx)));
  });

  legends.forEach((el) => {
    el.addEventListener('click', () => setHighlight(Number(el.dataset.idx)));
  });
}

/**
 * Render Interactive 6-Month Cashflow Grouped Bar Chart
 */
function renderCashflowBarChart(containerEl, monthsData) {
  if (!containerEl) return;

  const maxVal = Math.max(
    1,
    ...monthsData.map((m) => Math.max(m.income, m.expense))
  );

  const width = 340;
  const height = 165;
  const padTop = 14;
  const padBottom = 26;
  const chartH = height - padTop - padBottom;
  const groupW = width / monthsData.length;
  const barW = 14;
  const gap = 4;

  const gridLines = [0, 0.5, 1].map((r) => {
    const y = padTop + chartH * (1 - r);
    return `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="var(--md-sys-color-outline-variant)" stroke-dasharray="3 3" />`;
  }).join('');

  const groupsHtml = monthsData.map((m, idx) => {
    const cx = idx * groupW + groupW / 2;
    const incH = Math.max((m.income / maxVal) * chartH, m.income > 0 ? 4 : 0);
    const expH = Math.max((m.expense / maxVal) * chartH, m.expense > 0 ? 4 : 0);
    const incY = padTop + chartH - incH;
    const expY = padTop + chartH - expH;

    return `
      <g class="bar-group" data-idx="${idx}" style="cursor:pointer; transition: opacity 0.2s ease;">
        <rect x="${idx * groupW}" y="0" width="${groupW}" height="${height}" fill="transparent" />
        <rect class="bar-inc bar-anim" style="animation-delay:${idx * 55}ms;" x="${cx - barW - gap / 2}" y="${incY}" width="${barW}" height="${incH}" rx="5" fill="var(--income)" />
        <rect class="bar-exp bar-anim" style="animation-delay:${idx * 55 + 35}ms;" x="${cx + gap / 2}" y="${expY}" width="${barW}" height="${expH}" rx="5" fill="var(--expense)" />
        <text x="${cx}" y="${height - 7}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--md-sys-color-on-surface-variant)">${escapeHtml(m.label)}</text>
      </g>
    `;
  }).join('');

  const defaultIdx = monthsData.length - 1;

  containerEl.innerHTML = `
    <div style="display:flex; gap:14px; font-size:12px; margin-bottom:8px; color:var(--md-sys-color-on-surface-variant); font-weight:600;">
      <span style="display:inline-flex;align-items:center;gap:6px;"><span style="width:9px;height:9px;border-radius:3px;background:var(--income);"></span>Pemasukan</span>
      <span style="display:inline-flex;align-items:center;gap:6px;"><span style="width:9px;height:9px;border-radius:3px;background:var(--expense);"></span>Pengeluaran</span>
    </div>
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Grafik Arus Kas 6 Bulan">
      ${gridLines}
      ${groupsHtml}
    </svg>
    <div class="bar-chart-tooltip" id="barTooltip"></div>
  `;

  const tooltip = containerEl.querySelector('#barTooltip');
  const groups = containerEl.querySelectorAll('.bar-group');

  function selectMonth(idx) {
    const m = monthsData[idx];
    if (!m) return;
    groups.forEach((g, i) => {
      g.style.opacity = (i === idx) ? '1' : '0.42';
    });
    const net = m.income - m.expense;
    tooltip.innerHTML = `
      <div>
        <div style="font-weight:800;color:var(--md-sys-color-on-surface);">${escapeHtml(m.fullLabel)}</div>
        <div style="color:var(--md-sys-color-on-surface-variant);margin-top:2px;">Selisih: <strong class="num" style="color:${net >= 0 ? 'var(--income)' : 'var(--expense)'};">${net >= 0 ? '+' : ''}${formatRpFull(net)}</strong></div>
      </div>
      <div style="text-align:right;" class="num">
        <div style="color:var(--income);font-weight:800;">+${formatRpFull(m.income)}</div>
        <div style="color:var(--expense);font-weight:800;margin-top:2px;">−${formatRpFull(m.expense)}</div>
      </div>
    `;
  }

  groups.forEach((g) => {
    g.addEventListener('click', () => selectMonth(Number(g.dataset.idx)));
  });

  selectMonth(defaultIdx);
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
