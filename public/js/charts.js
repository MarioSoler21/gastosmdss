const SVG_NS = 'http://www.w3.org/2000/svg';

function fmtCompact(n, symbol = 'L') {
  const v = Number(n || 0);
  const abs = Math.abs(v);
  if (abs >= 1000000) return `${symbol} ${(v / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `${symbol} ${(v / 1000).toFixed(1)}K`;
  return `${symbol} ${v.toFixed(0)}`;
}

function fmtFull(n, symbol = 'L') {
  return `${symbol} ${Number(n || 0).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function el(tag, attrs, ns) {
  const node = ns ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k, v]) => node.setAttribute(k, v));
  return node;
}

function ensureTooltip() {
  let tip = document.getElementById('chartTooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'chartTooltip';
    tip.className = 'chart-tooltip';
    tip.setAttribute('role', 'status');
    document.body.appendChild(tip);
  }
  return tip;
}

function showTooltip(evt, rowsHtml) {
  const tip = ensureTooltip();
  tip.innerHTML = rowsHtml;
  tip.classList.add('visible');
  const x = evt.clientX ?? 0;
  const y = evt.clientY ?? 0;
  const tipRect = tip.getBoundingClientRect();
  let left = x + 14;
  let top = y - tipRect.height - 14;
  if (left + tipRect.width > window.innerWidth - 8) left = window.innerWidth - tipRect.width - 8;
  if (top < 8) top = y + 14;
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}

function hideTooltip() {
  const tip = document.getElementById('chartTooltip');
  if (tip) tip.classList.remove('visible');
}

function tooltipRow(colorVar, label, value) {
  const row = document.createElement('div');
  row.className = 'tt-row';
  const key = document.createElement('span');
  key.className = 'tt-key';
  key.style.background = colorVar;
  const lbl = document.createElement('span');
  lbl.className = 'tt-label';
  lbl.textContent = label;
  const val = document.createElement('span');
  val.className = 'tt-value';
  val.textContent = value;
  row.append(key, lbl, val);
  return row;
}

function buildTooltipHtml(entries) {
  const wrap = document.createElement('div');
  entries.forEach(({ color, label, value }) => wrap.appendChild(tooltipRow(color, label, value)));
  return wrap.innerHTML;
}

function renderLegend(container, items) {
  container.innerHTML = '';
  if (items.length < 2) return;
  items.forEach((it) => {
    const chip = document.createElement('span');
    chip.className = 'legend-chip';
    const dot = document.createElement('span');
    dot.className = 'legend-dot';
    dot.style.background = it.color;
    const label = document.createElement('span');
    label.textContent = it.label;
    chip.append(dot, label);
    container.appendChild(chip);
  });
}

/**
 * Horizontal bar chart. rows: [{ label, bars: [{ value, color, seriesLabel }] }]
 */
function renderHBarChart(svgContainer, rows, opts = {}) {
  const barThickness = opts.barThickness ?? 16;
  const barGap = 2;
  const groupGap = 14;
  const labelWidth = opts.labelWidth ?? 96;
  const width = opts.width ?? 560;
  const rightPad = 56;
  const chartAreaWidth = width - labelWidth - rightPad;
  const symbol = opts.symbol ?? 'L';

  const maxValue = Math.max(1, ...rows.flatMap((r) => r.bars.map((b) => b.value)));

  let y = 8;
  const rowBlocks = rows.map((row) => {
    const blockHeight = row.bars.length * barThickness + (row.bars.length - 1) * barGap;
    const block = { row, top: y, blockHeight };
    y += blockHeight + groupGap;
    return block;
  });
  const height = y - groupGap + 8;

  svgContainer.innerHTML = '';
  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, width: '100%', height, role: 'img' }, true);

  rowBlocks.forEach(({ row, top, blockHeight }) => {
    const labelY = top + blockHeight / 2;
    const label = el('text', {
      x: labelWidth - 10, y: labelY + 4, 'text-anchor': 'end', class: 'chart-axis-label',
    }, true);
    label.textContent = row.label;
    svg.appendChild(label);

    row.bars.forEach((bar, i) => {
      const barY = top + i * (barThickness + barGap);
      const barW = Math.max(2, (bar.value / maxValue) * chartAreaWidth);
      const isSelected = opts.selectedLabel && opts.selectedLabel === row.label;
      const classes = ['chart-bar'];
      if (opts.onBarClick) classes.push('clickable');
      if (isSelected) classes.push('selected');
      const rect = el('rect', {
        x: labelWidth, y: barY, width: barW, height: barThickness,
        rx: 4, ry: 4, fill: bar.color, class: classes.join(' '), tabindex: 0,
        role: 'img', 'aria-label': `${row.label} ${bar.seriesLabel || ''}: ${fmtFull(bar.value, symbol)}`,
      }, true);
      svg.appendChild(rect);

      const canFit = barW > 46;
      const valueText = el('text', {
        x: canFit ? labelWidth + barW - 6 : labelWidth + barW + 6,
        y: barY + barThickness / 2 + 4,
        'text-anchor': canFit ? 'end' : 'start',
        class: canFit ? 'chart-value-inside' : 'chart-value-outside',
      }, true);
      valueText.textContent = fmtCompact(bar.value, symbol);
      svg.appendChild(valueText);

      const showTip = (evt) => {
        rect.classList.add('hovered');
        showTooltip(evt, buildTooltipHtml([{ color: bar.color, label: row.label, value: fmtFull(bar.value, symbol) }]));
      };
      rect.addEventListener('pointermove', showTip);
      rect.addEventListener('pointerenter', showTip);
      rect.addEventListener('focus', (e) => showTip({ clientX: rect.getBoundingClientRect().right, clientY: rect.getBoundingClientRect().top }));
      rect.addEventListener('pointerleave', () => { rect.classList.remove('hovered'); hideTooltip(); });
      rect.addEventListener('blur', () => { rect.classList.remove('hovered'); hideTooltip(); });
      if (opts.onBarClick) {
        rect.addEventListener('click', () => opts.onBarClick(row));
        rect.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opts.onBarClick(row); } });
      }
    });
  });

  svgContainer.appendChild(svg);
}

/**
 * Grouped vertical column chart (multi-series time trend).
 * cols: [{ label, bars: [{ value, color, seriesLabel }] }]
 */
function renderGroupedColChart(svgContainer, cols, opts = {}) {
  const width = opts.width ?? 560;
  const height = opts.height ?? 220;
  const symbol = opts.symbol ?? 'L';
  const topPad = 24;
  const bottomPad = 30;
  const chartAreaHeight = height - topPad - bottomPad;
  const seriesCount = Math.max(1, ...cols.map((c) => c.bars.length));
  const step = (width - 20) / cols.length;
  const barGap = 2;
  const groupPad = 10;
  const barThickness = Math.max(6, Math.min(22, (step - groupPad * 2 - barGap * (seriesCount - 1)) / seriesCount));
  const maxValue = Math.max(1, ...cols.flatMap((c) => c.bars.map((b) => b.value)));

  svgContainer.innerHTML = '';
  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, width: '100%', height, role: 'img' }, true);

  const baseline = el('line', {
    x1: 10, y1: height - bottomPad, x2: width - 10, y2: height - bottomPad, class: 'chart-baseline',
  }, true);
  svg.appendChild(baseline);

  cols.forEach((col, i) => {
    const groupCenter = 10 + step * i + step / 2;
    const groupWidth = col.bars.length * barThickness + (col.bars.length - 1) * barGap;
    const groupStart = groupCenter - groupWidth / 2;

    col.bars.forEach((bar, j) => {
      const barX = groupStart + j * (barThickness + barGap);
      const barH = Math.max(2, (bar.value / maxValue) * chartAreaHeight);
      const barY = height - bottomPad - barH;
      const rect = el('rect', {
        x: barX, y: barY, width: barThickness, height: barH,
        rx: 3, ry: 3, fill: bar.color, class: 'chart-bar', tabindex: 0,
        role: 'img', 'aria-label': `${col.label} ${bar.seriesLabel || ''}: ${fmtFull(bar.value, symbol)}`,
      }, true);
      svg.appendChild(rect);

      const showTip = (evt) => {
        rect.classList.add('hovered');
        showTooltip(evt, buildTooltipHtml(col.bars.map((b) => ({ color: b.color, label: b.seriesLabel || col.label, value: fmtFull(b.value, symbol) }))));
      };
      rect.addEventListener('pointermove', showTip);
      rect.addEventListener('pointerenter', showTip);
      rect.addEventListener('focus', (e) => showTip({ clientX: rect.getBoundingClientRect().right, clientY: rect.getBoundingClientRect().top }));
      rect.addEventListener('pointerleave', () => { rect.classList.remove('hovered'); hideTooltip(); });
      rect.addEventListener('blur', () => { rect.classList.remove('hovered'); hideTooltip(); });
    });

    const catLabel = el('text', {
      x: groupCenter, y: height - bottomPad + 16, 'text-anchor': 'middle', class: 'chart-axis-label',
    }, true);
    catLabel.textContent = col.label;
    svg.appendChild(catLabel);
  });

  svgContainer.appendChild(svg);
}

/**
 * Diverging column chart around a zero baseline — for polarity metrics (net balance per period).
 * cols: [{ label, value }]. Color is assigned by sign (good/bad), not by identity.
 */
function renderDivergingColChart(svgContainer, cols, opts = {}) {
  const width = opts.width ?? 560;
  const height = opts.height ?? 200;
  const symbol = opts.symbol ?? 'L';
  const topPad = 20;
  const bottomPad = 24;
  const plotHeight = height - topPad - bottomPad;
  const midY = topPad + plotHeight / 2;
  const maxAbs = Math.max(1, ...cols.map((c) => Math.abs(c.value)));
  const step = (width - 20) / cols.length;
  const barThickness = Math.min(28, step - 16);

  svgContainer.innerHTML = '';
  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, width: '100%', height, role: 'img' }, true);

  const baseline = el('line', { x1: 10, y1: midY, x2: width - 10, y2: midY, class: 'chart-baseline' }, true);
  svg.appendChild(baseline);

  cols.forEach((col, i) => {
    const cx = 10 + step * i + step / 2;
    const isGood = col.value >= 0;
    const barLen = Math.max(2, (Math.abs(col.value) / maxAbs) * (plotHeight / 2));
    const barY = isGood ? midY - barLen : midY;
    const color = isGood ? 'var(--delta-good)' : 'var(--delta-bad)';
    const rect = el('rect', {
      x: cx - barThickness / 2, y: barY, width: barThickness, height: barLen,
      rx: 3, ry: 3, fill: color, class: 'chart-bar', tabindex: 0,
      role: 'img', 'aria-label': `${col.label}: ${fmtFull(col.value, symbol)}`,
    }, true);
    svg.appendChild(rect);

    const valueLabel = el('text', {
      x: cx, y: isGood ? barY - 6 : barY + barLen + 14, 'text-anchor': 'middle', class: 'chart-value-outside',
    }, true);
    valueLabel.textContent = fmtCompact(col.value, symbol);
    svg.appendChild(valueLabel);

    const catLabel = el('text', {
      x: cx, y: height - 6, 'text-anchor': 'middle', class: 'chart-axis-label',
    }, true);
    catLabel.textContent = col.label;
    svg.appendChild(catLabel);

    const showTip = (evt) => {
      rect.classList.add('hovered');
      showTooltip(evt, buildTooltipHtml([{ color, label: col.label, value: fmtFull(col.value, symbol) }]));
    };
    rect.addEventListener('pointermove', showTip);
    rect.addEventListener('pointerenter', showTip);
    rect.addEventListener('focus', (e) => showTip({ clientX: rect.getBoundingClientRect().right, clientY: rect.getBoundingClientRect().top }));
    rect.addEventListener('pointerleave', () => { rect.classList.remove('hovered'); hideTooltip(); });
    rect.addEventListener('blur', () => { rect.classList.remove('hovered'); hideTooltip(); });
  });

  svgContainer.appendChild(svg);
}

/**
 * Giant stacked column chart — categories stacked per period, meant to compare
 * many periods side by side (horizontally scrollable). cols: [{ label, bars: [{ value, color, seriesLabel }] }]
 */
function renderStackedColChart(svgContainer, cols, opts = {}) {
  const height = opts.height ?? 320;
  const barWidth = opts.barWidth ?? 46;
  const gap = opts.gap ?? 26;
  const minWidth = opts.minWidth ?? 560;
  const width = Math.max(minWidth, cols.length * (barWidth + gap) + gap);
  const symbol = opts.symbol ?? 'L';
  const topPad = 30;
  const bottomPad = 30;
  const chartAreaHeight = height - topPad - bottomPad;
  const totals = cols.map((c) => c.bars.reduce((s, b) => s + b.value, 0));
  const maxValue = Math.max(1, ...totals);

  svgContainer.innerHTML = '';
  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, width, height, role: 'img' }, true);

  const baseline = el('line', {
    x1: 10, y1: height - bottomPad, x2: width - 10, y2: height - bottomPad, class: 'chart-baseline',
  }, true);
  svg.appendChild(baseline);

  cols.forEach((col, i) => {
    const cx = 10 + gap / 2 + i * (barWidth + gap) + barWidth / 2;
    let cursorY = height - bottomPad;
    const visibleBars = col.bars.filter((b) => b.value > 0);

    visibleBars.forEach((bar) => {
      const barH = Math.max(2, (bar.value / maxValue) * chartAreaHeight);
      const barY = cursorY - barH;
      const rect = el('rect', {
        x: cx - barWidth / 2, y: barY, width: barWidth, height: barH,
        fill: bar.color, class: 'chart-bar', tabindex: 0,
        role: 'img', 'aria-label': `${col.label} ${bar.seriesLabel || ''}: ${fmtFull(bar.value, symbol)}`,
      }, true);
      svg.appendChild(rect);
      cursorY = barY;

      const showTip = (evt) => {
        rect.classList.add('hovered');
        showTooltip(evt, buildTooltipHtml(visibleBars.map((b) => ({ color: b.color, label: b.seriesLabel || col.label, value: fmtFull(b.value, symbol) }))));
      };
      rect.addEventListener('pointermove', showTip);
      rect.addEventListener('pointerenter', showTip);
      rect.addEventListener('focus', (e) => showTip({ clientX: rect.getBoundingClientRect().right, clientY: rect.getBoundingClientRect().top }));
      rect.addEventListener('pointerleave', () => { rect.classList.remove('hovered'); hideTooltip(); });
      rect.addEventListener('blur', () => { rect.classList.remove('hovered'); hideTooltip(); });
    });

    const totalLabel = el('text', {
      x: cx, y: cursorY - 8, 'text-anchor': 'middle', class: 'chart-value-outside',
    }, true);
    totalLabel.textContent = fmtCompact(totals[i], symbol);
    svg.appendChild(totalLabel);

    const catLabel = el('text', {
      x: cx, y: height - bottomPad + 16, 'text-anchor': 'middle', class: 'chart-axis-label',
    }, true);
    catLabel.textContent = col.label;
    svg.appendChild(catLabel);
  });

  svgContainer.appendChild(svg);
}

/**
 * Vertical column chart. cols: [{ label, value, color }]
 */
function renderColChart(svgContainer, cols, opts = {}) {
  const width = opts.width ?? 560;
  const height = opts.height ?? 200;
  const symbol = opts.symbol ?? 'L';
  const barThickness = Math.min(32, (width - 40) / cols.length - 10);
  const topPad = 24;
  const bottomPad = 28;
  const chartAreaHeight = height - topPad - bottomPad;
  const maxValue = Math.max(1, ...cols.map((c) => c.value));
  const step = (width - 20) / cols.length;

  svgContainer.innerHTML = '';
  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, width: '100%', height, role: 'img' }, true);

  const baseline = el('line', {
    x1: 10, y1: height - bottomPad, x2: width - 10, y2: height - bottomPad, class: 'chart-baseline',
  }, true);
  svg.appendChild(baseline);

  cols.forEach((col, i) => {
    const cx = 10 + step * i + step / 2;
    const barH = Math.max(2, (col.value / maxValue) * chartAreaHeight);
    const barY = height - bottomPad - barH;
    const rect = el('rect', {
      x: cx - barThickness / 2, y: barY, width: barThickness, height: barH,
      rx: 4, ry: 4, fill: col.color, class: 'chart-bar', tabindex: 0,
      role: 'img', 'aria-label': `${col.label}: ${fmtFull(col.value, symbol)}`,
    }, true);
    svg.appendChild(rect);

    const valueLabel = el('text', {
      x: cx, y: barY - 6, 'text-anchor': 'middle', class: 'chart-value-outside',
    }, true);
    valueLabel.textContent = fmtCompact(col.value, symbol);
    svg.appendChild(valueLabel);

    const catLabel = el('text', {
      x: cx, y: height - bottomPad + 16, 'text-anchor': 'middle', class: 'chart-axis-label',
    }, true);
    catLabel.textContent = col.label;
    svg.appendChild(catLabel);

    const showTip = (evt) => {
      rect.classList.add('hovered');
      showTooltip(evt, buildTooltipHtml([{ color: col.color, label: col.label, value: fmtFull(col.value, symbol) }]));
    };
    rect.addEventListener('pointermove', showTip);
    rect.addEventListener('pointerenter', showTip);
    rect.addEventListener('focus', (e) => showTip({ clientX: rect.getBoundingClientRect().right, clientY: rect.getBoundingClientRect().top }));
    rect.addEventListener('pointerleave', () => { rect.classList.remove('hovered'); hideTooltip(); });
    rect.addEventListener('blur', () => { rect.classList.remove('hovered'); hideTooltip(); });
  });

  svgContainer.appendChild(svg);
}
