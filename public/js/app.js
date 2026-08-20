const numFmt = (n) => Number(n || 0).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtL = (n) => `L ${numFmt(n)}`;
const fmtMoney = (n, sym) => `${sym} ${numFmt(n)}`;

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

const state = { gastos: [], ingresos: [] };
const filters = { period: 'mes', currency: 'L', categoria: null, busqueda: '', fechaDesde: null, fechaHasta: null };

function montoField() { return filters.currency === 'L' ? 'montoRealL' : 'montoUSD'; }

function switchView(name) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById(`view-${name}`).classList.add('active');
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  document.body.classList.toggle('codabi-theme', name === 'codabi');
}

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

document.querySelectorAll('#periodPills .pill').forEach((btn) => {
  btn.addEventListener('click', () => {
    filters.period = btn.dataset.period;
    filters.fechaDesde = null;
    filters.fechaHasta = null;
    document.getElementById('fechaDesde').value = '';
    document.getElementById('fechaHasta').value = '';
    document.getElementById('limpiarFechas').style.display = 'none';
    document.querySelectorAll('#periodPills .pill').forEach((b) => b.classList.toggle('active', b === btn));
    renderReportes();
  });
});

function onFechaChange() {
  filters.fechaDesde = document.getElementById('fechaDesde').value || null;
  filters.fechaHasta = document.getElementById('fechaHasta').value || null;
  const activo = !!(filters.fechaDesde || filters.fechaHasta);
  document.querySelectorAll('#periodPills .pill').forEach((b) => b.classList.remove('active'));
  document.getElementById('limpiarFechas').style.display = activo ? 'inline-flex' : 'none';
  renderReportes();
}
document.getElementById('fechaDesde').addEventListener('change', onFechaChange);
document.getElementById('fechaHasta').addEventListener('change', onFechaChange);
document.getElementById('limpiarFechas').addEventListener('click', () => {
  filters.fechaDesde = null;
  filters.fechaHasta = null;
  document.getElementById('fechaDesde').value = '';
  document.getElementById('fechaHasta').value = '';
  document.getElementById('limpiarFechas').style.display = 'none';
  filters.period = 'mes';
  document.querySelectorAll('#periodPills .pill').forEach((b) => b.classList.toggle('active', b.dataset.period === 'mes'));
  renderReportes();
});

document.querySelectorAll('#currencyToggle .pill').forEach((btn) => {
  btn.addEventListener('click', () => {
    filters.currency = btn.dataset.currency;
    document.querySelectorAll('#currencyToggle .pill').forEach((b) => b.classList.toggle('active', b === btn));
    renderReportes();
    renderCodabi();
  });
});

document.getElementById('categoriaSelect').addEventListener('change', (e) => {
  filters.categoria = e.target.value || null;
  renderReportes();
});

document.getElementById('buscarDescripcion').addEventListener('input', (e) => {
  filters.busqueda = e.target.value;
  renderReportes();
});

document.getElementById('limpiarFiltroCategoria').addEventListener('click', () => {
  filters.categoria = null;
  renderReportes();
});

async function api(path, options) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error de red');
  return data;
}

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function parseFechaSheet(fechaStr) {
  if (!fechaStr) return null;
  const soloFecha = /^\d{4}-\d{2}-\d{2}$/.test(fechaStr);
  const d = new Date(soloFecha ? `${fechaStr}T00:00:00` : fechaStr);
  return Number.isNaN(d.getTime()) ? null : d;
}

function esMesActual(mesStr) {
  return mesStr === MESES[new Date().getMonth()];
}

function mesAnteriorNombre() {
  return MESES[(new Date().getMonth() + 11) % 12];
}

function monthKey(fechaISO) {
  return fechaISO && /^\d{4}-\d{2}/.test(fechaISO) ? fechaISO.slice(0, 7) : null;
}

function monthKeyLabel(key) {
  const [y, m] = key.split('-');
  return `${MESES[parseInt(m, 10) - 1].slice(0, 3)} ${y.slice(2)}`;
}

function monthKeysForPeriod(period) {
  const now = new Date();
  const keyFor = (offset) => {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  if (period === 'mes') return [keyFor(0)];
  if (period === 'mesPasado') return [keyFor(1)];
  if (period === '3meses') return [keyFor(0), keyFor(1), keyFor(2)];
  return null;
}

function filterByDateRange(list) {
  if (!filters.fechaDesde && !filters.fechaHasta) return list;
  return list.filter((item) => {
    if (!item.fecha) return false;
    if (filters.fechaDesde && item.fecha < filters.fechaDesde) return false;
    if (filters.fechaHasta && item.fecha > filters.fechaHasta) return false;
    return true;
  });
}

function filterByPeriod(list) {
  if (filters.fechaDesde || filters.fechaHasta) return filterByDateRange(list);
  const keys = monthKeysForPeriod(filters.period);
  if (!keys) return list;
  return list.filter((item) => keys.includes(monthKey(item.fecha)));
}

function filterByCategoriaYFecha(list) {
  const porCategoria = filters.categoria ? list.filter((g) => g.categoria === filters.categoria) : list;
  return filterByDateRange(porCategoria);
}

function lunesDeLaSemana(fechaISO) {
  const d = new Date(`${fechaISO}T00:00:00`);
  const diaSemana = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - diaSemana);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function semanaLabel(lunesISO) {
  const d = new Date(`${lunesISO}T00:00:00`);
  return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`;
}

function diasDeLaSemana(lunesISO) {
  const base = new Date(`${lunesISO}T00:00:00`);
  const dias = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dias.push(`${y}-${m}-${day}`);
  }
  return dias;
}

function hoyISOLocal() {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, '0');
  const d = String(n.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function semanaRangoLabel(lunesISO) {
  const inicio = new Date(`${lunesISO}T00:00:00`);
  const fin = new Date(inicio);
  fin.setDate(inicio.getDate() + 6);
  const iniTxt = `${inicio.getDate()} ${MESES[inicio.getMonth()].slice(0, 3)}`;
  const finTxt = `${fin.getDate()} ${MESES[fin.getMonth()].slice(0, 3)}`;
  return `${iniTxt} – ${finTxt}`;
}

let diaExpandido = null;

function renderDiasPorSemana(gastosFiltrados, sym, field, container, emptyEl) {
  const conFecha = gastosFiltrados.filter((g) => g.fecha);
  if (conFecha.length === 0) {
    container.innerHTML = '';
    emptyEl.style.display = 'block';
    return;
  }
  emptyEl.style.display = 'none';

  const porSemana = {};
  conFecha.forEach((g) => {
    const lunes = lunesDeLaSemana(g.fecha);
    (porSemana[lunes] = porSemana[lunes] || []).push(g);
  });
  const MAX_SEMANAS = 20;
  const semanasKeys = Object.keys(porSemana).sort((a, b) => b.localeCompare(a)).slice(0, MAX_SEMANAS);
  const hoyISO = hoyISOLocal();

  container.innerHTML = '';
  semanasKeys.forEach((lunes) => {
    const gastosSemana = porSemana[lunes];
    const totalSemana = gastosSemana.reduce((s, g) => s + Number(g[field] || 0), 0);
    const dias = diasDeLaSemana(lunes);
    const porDia = {};
    gastosSemana.forEach((g) => { (porDia[g.fecha] = porDia[g.fecha] || []).push(g); });
    const maxDia = Math.max(1, ...dias.map((d) => (porDia[d] || []).reduce((s, g) => s + Number(g[field] || 0), 0)));

    const grupo = document.createElement('div');
    grupo.className = 'semana-grupo';

    const header = document.createElement('div');
    header.className = 'semana-header';
    header.innerHTML = `<span class="semana-titulo">Semana del ${semanaRangoLabel(lunes)}</span><span class="semana-total">${fmtMoney(totalSemana, sym)}</span>`;
    grupo.appendChild(header);

    const row = document.createElement('div');
    row.className = 'dias-row';

    dias.forEach((fecha) => {
      const items = porDia[fecha] || [];
      const sinGastos = items.length === 0;
      const monto = items.reduce((s, g) => s + Number(g[field] || 0), 0);
      const dt = parseFechaSheet(fecha);
      const barPx = sinGastos ? 0 : Math.max(4, Math.round((monto / maxDia) * 60));

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = [
        'dia-block',
        sinGastos ? 'sin-gastos' : '',
        fecha === diaExpandido ? 'activo' : '',
        fecha === hoyISO ? 'es-hoy' : '',
      ].filter(Boolean).join(' ');
      btn.innerHTML = `
        <span class="dia-barra" style="height:${barPx}px"></span>
        <span class="dia-monto">${sinGastos ? '—' : fmtCompact(monto, sym)}</span>
        <span class="dia-nombre">${DIAS_SEMANA[dt.getDay()]} ${dt.getDate()}</span>
      `;
      if (!sinGastos) {
        btn.addEventListener('click', () => {
          diaExpandido = diaExpandido === fecha ? null : fecha;
          renderReportes();
        });
      }
      row.appendChild(btn);
    });
    grupo.appendChild(row);

    if (diaExpandido && dias.includes(diaExpandido)) {
      const items = (porDia[diaExpandido] || []).slice().reverse();
      const dt = parseFechaSheet(diaExpandido);
      const totalDia = items.reduce((s, g) => s + Number(g[field] || 0), 0);

      const detalle = document.createElement('div');
      detalle.className = 'dia-detalle';

      const encabezado = document.createElement('div');
      encabezado.className = 'dia-detalle-encabezado';
      encabezado.textContent = `${DIAS_SEMANA[dt.getDay()]} ${dt.getDate()} de ${MESES[dt.getMonth()]} — ${fmtMoney(totalDia, sym)}`;
      detalle.appendChild(encabezado);

      items.forEach((g) => {
        const item = document.createElement('div');
        item.className = 'dia-detalle-item';
        item.innerHTML = `
          <span class="ddi-info"><span class="ddi-cat">${esc(g.categoria)}</span>${esc(g.descripcion || 'Sin descripción')}</span>
          <span class="ddi-monto">${fmtMoney(g[field], sym)}</span>
        `;
        detalle.appendChild(item);
      });
      grupo.appendChild(detalle);
    }

    container.appendChild(grupo);
  });
}

async function refetchAll() {
  const [gastos, ingresos] = await Promise.all([api('/gastos'), api('/ingresos')]);
  state.gastos = gastos;
  state.ingresos = ingresos;
}

function renderAll() {
  renderDashboard();
  renderGastos();
  renderIngresos();
  renderReportes();
  renderCodabi();
}

async function cargarTodo() {
  await refetchAll();
  renderAll();
}

function renderDashboard() {
  const { gastos, ingresos } = state;
  const gastosMes = gastos.filter((g) => esMesActual(g.mes));
  const ingresosMes = ingresos.filter((i) => esMesActual(i.mes));

  const totalGastos = gastosMes.reduce((sum, g) => sum + Number(g.montoRealL || 0), 0);
  const totalIngresos = ingresosMes.reduce((sum, i) => sum + Number(i.montoRealL || 0), 0);
  const totalHormiga = gastosMes
    .filter((g) => Number(g.hormigaFlag) === 1)
    .reduce((sum, g) => sum + Number(g.montoRealL || 0), 0);

  document.getElementById('totalGastosMes').textContent = fmtL(totalGastos);
  document.getElementById('totalIngresosMes').textContent = fmtL(totalIngresos);
  document.getElementById('balanceMes').textContent = fmtL(totalIngresos - totalGastos);
  document.getElementById('totalHormigaMes').textContent = fmtL(totalHormiga);

  const recientes = [
    ...gastos.map((g) => ({ ...g, tipo: 'Gasto', detalle: `${g.categoria} - ${g.descripcion || ''}`, signo: -1 })),
    ...ingresos.map((i) => ({ ...i, tipo: 'Ingreso', detalle: i.cliente ? `${i.medio} - ${i.cliente}` : i.medio, signo: 1 })),
  ]
    .sort((a, b) => parseFechaSheet(b.fecha) - parseFechaSheet(a.fecha))
    .slice(0, 15);

  const tbody = document.querySelector('#tablaRecientes tbody');
  tbody.innerHTML = recientes
    .map((r) => `<tr><td>${esc(r.fecha)}</td><td>${esc(r.tipo)}</td><td>${esc(r.detalle)}</td><td>${fmtL(r.signo * r.montoRealL)}</td></tr>`)
    .join('');
}

function renderGastos() {
  const tbody = document.querySelector('#tablaGastos tbody');
  tbody.innerHTML = state.gastos
    .slice()
    .reverse()
    .map((g) => `
      <tr>
        <td>${esc(g.fecha)}</td><td>${esc(g.cuenta)}</td><td>${esc(g.categoria)}</td>
        <td>${esc(g.moneda)}</td><td>${esc(g.monto)}</td><td>${fmtL(g.montoRealL)}</td><td>$ ${numFmt(g.montoUSD)}</td>
        <td>${Number(g.hormigaFlag) === 1 ? '<span class="badge-hormiga">hormiga</span>' : ''}</td>
      </tr>`)
    .join('');
}

function renderIngresos() {
  const tbody = document.querySelector('#tablaIngresos tbody');
  tbody.innerHTML = state.ingresos
    .slice()
    .reverse()
    .map((i) => `
      <tr>
        <td>${esc(i.fecha)}</td><td>${esc(i.medio)}</td><td>${esc(i.cliente)}</td>
        <td>${esc(i.moneda)}</td><td>${esc(i.monto)}</td><td>${fmtL(i.montoRealL)}</td><td>$ ${numFmt(i.montoUSD)}</td>
      </tr>`)
    .join('');
}

const CATEGORY_PALETTE = [
  'var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)',
  'var(--series-5)', 'var(--series-6)', 'var(--series-7)',
];

function buildCategoryColorMap(gastos) {
  const totals = {};
  gastos.forEach((g) => { totals[g.categoria] = (totals[g.categoria] || 0) + Number(g.montoRealL || 0); });
  const sorted = Object.keys(totals).sort((a, b) => totals[b] - totals[a]);
  const map = {};
  sorted.forEach((cat, i) => { map[cat] = i < CATEGORY_PALETTE.length ? CATEGORY_PALETTE[i] : 'var(--series-other)'; });
  return map;
}

function sumBy(list, keyFn, valueFn) {
  const totals = {};
  list.forEach((item) => { const k = keyFn(item); totals[k] = (totals[k] || 0) + valueFn(item); });
  return totals;
}

function renderReportes() {
  const { gastos, ingresos } = state;
  const sym = filters.currency;
  const field = montoField();

  const gastosPeriodo = filterByPeriod(gastos);
  const ingresosPeriodo = filterByPeriod(ingresos);

  const totalGastos = gastosPeriodo.reduce((s, g) => s + Number(g[field] || 0), 0);
  const totalIngresos = ingresosPeriodo.reduce((s, i) => s + Number(i[field] || 0), 0);
  const totalHormiga = gastosPeriodo.filter((g) => Number(g.hormigaFlag) === 1).reduce((s, g) => s + Number(g[field] || 0), 0);
  const hormigaPct = totalGastos > 0 ? (totalHormiga / totalGastos) * 100 : 0;
  const tasaAhorro = totalIngresos > 0 ? ((totalIngresos - totalGastos) / totalIngresos) * 100 : 0;

  document.getElementById('kpiIngresos').textContent = fmtMoney(totalIngresos, sym);
  document.getElementById('kpiGastos').textContent = fmtMoney(totalGastos, sym);
  document.getElementById('kpiBalance').textContent = fmtMoney(totalIngresos - totalGastos, sym);
  document.getElementById('kpiAhorro').textContent = `${tasaAhorro.toFixed(1)}%`;
  document.getElementById('kpiAhorroCard').className = `card ${tasaAhorro >= 0 ? 'card-delta-down' : 'card-delta-up'}`;
  document.getElementById('kpiHormigaPct').textContent = `${hormigaPct.toFixed(1)}%`;
  document.getElementById('kpiHormigaTotal').textContent = fmtMoney(totalHormiga, sym);

  let promedioLabel = 'Gasto promedio diario';
  let promedioValue = 0;
  const now = new Date();
  if (filters.period === 'mes') {
    promedioValue = totalGastos / now.getDate();
  } else if (filters.period === 'mesPasado') {
    const diasMesPasado = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    promedioValue = totalGastos / diasMesPasado;
  } else if (filters.period === '3meses') {
    promedioLabel = 'Gasto promedio mensual';
    promedioValue = totalGastos / 3;
  } else {
    promedioLabel = 'Gasto promedio mensual';
    const mesesDistintos = new Set(gastosPeriodo.map((g) => monthKey(g.fecha)).filter(Boolean)).size || 1;
    promedioValue = totalGastos / mesesDistintos;
  }
  document.getElementById('kpiPromedioLabel').textContent = promedioLabel;
  document.getElementById('kpiPromedio').textContent = fmtMoney(promedioValue, sym);

  const colorMap = buildCategoryColorMap(gastos);

  const categoriaSelect = document.getElementById('categoriaSelect');
  const categoriasDisponibles = Object.keys(colorMap);
  const opcionesActuales = [...categoriaSelect.options].map((o) => o.value).join('|');
  if (opcionesActuales !== ['', ...categoriasDisponibles].join('|')) {
    categoriaSelect.innerHTML = '<option value="">Todas las categorías</option>'
      + categoriasDisponibles.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  }
  categoriaSelect.value = filters.categoria || '';
  categoriaSelect.classList.toggle('active', !!filters.categoria);

  const gastosFiltrados = filters.categoria ? gastosPeriodo.filter((g) => g.categoria === filters.categoria) : gastosPeriodo;

  const totalsCat = sumBy(gastosPeriodo, (g) => g.categoria, (g) => Number(g[field] || 0));
  const catEntries = Object.entries(totalsCat).sort((a, b) => b[1] - a[1]);
  const catEmpty = document.getElementById('chartCategoriaEmpty');
  const catContainer = document.getElementById('chartCategoria');
  if (catEntries.length === 0) {
    catContainer.innerHTML = '';
    catEmpty.style.display = 'block';
    document.getElementById('legendCategoria').innerHTML = '';
  } else {
    catEmpty.style.display = 'none';
    const top = catEntries.slice(0, 6);
    const restSum = catEntries.slice(6).reduce((s, [, v]) => s + v, 0);
    const rows = top.map(([cat, val]) => ({ label: cat, bars: [{ value: val, color: colorMap[cat] || 'var(--series-other)' }] }));
    if (restSum > 0) rows.push({ label: 'Otras', bars: [{ value: restSum, color: 'var(--series-other)' }] });
    renderHBarChart(catContainer, rows, {
      labelWidth: 90,
      symbol: sym,
      selectedLabel: filters.categoria,
      onBarClick: (row) => {
        if (row.label === 'Otras') return;
        filters.categoria = filters.categoria === row.label ? null : row.label;
        renderReportes();
      },
    });
    renderLegend(document.getElementById('legendCategoria'), rows.map((r) => ({ color: r.bars[0].color, label: r.label })));
  }

  let detalle = filters.categoria ? gastos.filter((g) => g.categoria === filters.categoria) : gastos;
  if (filters.busqueda.trim()) {
    const q = filters.busqueda.trim().toLowerCase();
    detalle = detalle.filter((g) => (g.descripcion || '').toLowerCase().includes(q) || (g.categoria || '').toLowerCase().includes(q));
  }
  detalle = detalle.slice().reverse();

  const chip = document.getElementById('filtroCategoriaChip');
  if (filters.categoria) {
    chip.style.display = 'inline-flex';
    document.getElementById('filtroCategoriaTexto').textContent = `Categoría: ${filters.categoria}`;
  } else {
    chip.style.display = 'none';
  }

  const tablaDetalleEmpty = document.getElementById('tablaDetalleEmpty');
  document.querySelector('#tablaDetalle tbody').innerHTML = detalle
    .map((g) => `<tr><td>${esc(g.fecha)}</td><td>${esc(g.categoria)}</td><td>${esc(g.descripcion)}</td><td>${fmtMoney(g[field], sym)}</td></tr>`)
    .join('');
  tablaDetalleEmpty.style.display = detalle.length === 0 ? 'block' : 'none';
  document.getElementById('detalleCount').textContent = `(${detalle.length} de ${gastos.length})`;

  const periodoTitulo = document.getElementById('chartPeriodoTitulo');
  const periodoEmpty = document.getElementById('chartPeriodoEmpty');
  const periodoContainer = document.getElementById('chartPeriodo');
  const fechaFiltroActiva = !!(filters.fechaDesde || filters.fechaHasta);
  const rangoDias = fechaFiltroActiva && filters.fechaDesde && filters.fechaHasta
    ? (new Date(filters.fechaHasta) - new Date(filters.fechaDesde)) / 86400000
    : null;
  const agruparPorSemana = fechaFiltroActiva
    ? (rangoDias === null || rangoDias <= 45)
    : (filters.period === 'mes' || filters.period === 'mesPasado');
  const sufijoCategoria = filters.categoria ? ` — ${filters.categoria}` : '';
  if (agruparPorSemana) {
    periodoTitulo.textContent = `Gastos por semana${sufijoCategoria}`;
    let semanas;
    let totalsSemana;
    if (fechaFiltroActiva) {
      totalsSemana = sumBy(gastosFiltrados, (g) => lunesDeLaSemana(g.fecha), (g) => Number(g[field] || 0));
      semanas = Object.keys(totalsSemana).sort();
    } else {
      totalsSemana = sumBy(gastosFiltrados, (g) => g.semana, (g) => Number(g[field] || 0));
      semanas = Object.keys(totalsSemana).sort((a, b) => parseInt(a.replace('Sem ', ''), 10) - parseInt(b.replace('Sem ', ''), 10));
    }
    if (semanas.length === 0) {
      periodoContainer.innerHTML = '';
      periodoEmpty.style.display = 'block';
    } else {
      periodoEmpty.style.display = 'none';
      renderColChart(periodoContainer, semanas.map((s) => ({
        label: fechaFiltroActiva ? semanaLabel(s) : s, value: totalsSemana[s], color: 'var(--series-1)',
      })), { symbol: sym });
    }
  } else {
    periodoTitulo.textContent = `Gastos por mes${sufijoCategoria}`;
    const totalsMes = sumBy(gastosFiltrados, (g) => monthKey(g.fecha), (g) => Number(g[field] || 0));
    delete totalsMes.null;
    const keys = Object.keys(totalsMes).sort();
    if (keys.length === 0) {
      periodoContainer.innerHTML = '';
      periodoEmpty.style.display = 'block';
    } else {
      periodoEmpty.style.display = 'none';
      renderColChart(periodoContainer, keys.map((k) => ({ label: monthKeyLabel(k), value: totalsMes[k], color: 'var(--series-1)' })), { symbol: sym });
    }
  }

  document.getElementById('diasSemanaTitulo').textContent = `Gastos por día${sufijoCategoria}`;
  renderDiasPorSemana(gastosFiltrados, sym, field, document.getElementById('semanasDias'), document.getElementById('semanasDiasEmpty'));

  const matrizGastos = filterByCategoriaYFecha(gastos);
  const matrizEmpty = document.getElementById('chartMatrizEmpty');
  const matrizContainer = document.getElementById('chartMatriz');
  const monthKeysMatriz = [...new Set(matrizGastos.map((g) => monthKey(g.fecha)).filter(Boolean))].sort().slice(-12);
  if (monthKeysMatriz.length === 0) {
    matrizContainer.innerHTML = '';
    matrizEmpty.style.display = 'block';
    document.getElementById('legendMatriz').innerHTML = '';
  } else {
    matrizEmpty.style.display = 'none';
    const todasCategorias = Object.keys(colorMap);
    const catsMatriz = filters.categoria ? [filters.categoria] : todasCategorias.slice(0, 6);
    const otrasIncluidas = !filters.categoria && todasCategorias.length > 6;
    const matrizCols = monthKeysMatriz.map((k) => {
      const gastosMes = matrizGastos.filter((g) => monthKey(g.fecha) === k);
      const bars = catsMatriz.map((cat) => ({
        value: gastosMes.filter((g) => g.categoria === cat).reduce((s, g) => s + Number(g[field] || 0), 0),
        color: colorMap[cat] || 'var(--series-1)',
        seriesLabel: cat,
      }));
      if (otrasIncluidas) {
        bars.push({
          value: gastosMes.filter((g) => !catsMatriz.includes(g.categoria)).reduce((s, g) => s + Number(g[field] || 0), 0),
          color: 'var(--series-other)',
          seriesLabel: 'Otras',
        });
      }
      return { label: monthKeyLabel(k), bars };
    });
    renderStackedColChart(matrizContainer, matrizCols, { symbol: sym });
    const legendItems = catsMatriz.map((cat) => ({ color: colorMap[cat] || 'var(--series-1)', label: cat }));
    if (otrasIncluidas) legendItems.push({ color: 'var(--series-other)', label: 'Otras' });
    renderLegend(document.getElementById('legendMatriz'), legendItems);
  }

  const mesActual = MESES[new Date().getMonth()];
  const mesPrevio = mesAnteriorNombre();
  const gastosMesActualFijo = gastos.filter((g) => g.mes === mesActual && (!filters.categoria || g.categoria === filters.categoria));
  const gastosMesAnteriorFijo = gastos.filter((g) => g.mes === mesPrevio && (!filters.categoria || g.categoria === filters.categoria));
  const totalGastosMesFijo = gastosMesActualFijo.reduce((s, g) => s + Number(g[field] || 0), 0);
  const totalGastosMesAnteriorFijo = gastosMesAnteriorFijo.reduce((s, g) => s + Number(g[field] || 0), 0);
  let variacionPct = 0;
  if (totalGastosMesAnteriorFijo > 0) variacionPct = ((totalGastosMesFijo - totalGastosMesAnteriorFijo) / totalGastosMesAnteriorFijo) * 100;
  else if (totalGastosMesFijo > 0) variacionPct = 100;
  document.getElementById('repGastosMesAnterior').textContent = fmtMoney(totalGastosMesAnteriorFijo, sym);
  document.getElementById('repVariacion').textContent = `${variacionPct >= 0 ? '+' : ''}${variacionPct.toFixed(1)}%`;
  document.getElementById('repVariacionCard').className = `card ${variacionPct > 0 ? 'card-delta-up' : 'card-delta-down'}`;

  const totalsCurr = sumBy(gastosMesActualFijo, (g) => g.categoria, (g) => Number(g[field] || 0));
  const totalsPrev = sumBy(gastosMesAnteriorFijo, (g) => g.categoria, (g) => Number(g[field] || 0));
  const allCats = [...new Set([...Object.keys(totalsCurr), ...Object.keys(totalsPrev)])]
    .sort((a, b) => (totalsCurr[b] || 0) - (totalsCurr[a] || 0));
  const compEmpty = document.getElementById('chartComparacionEmpty');
  const compContainer = document.getElementById('chartComparacion');
  if (allCats.length === 0) {
    compContainer.innerHTML = '';
    compEmpty.style.display = 'block';
    document.getElementById('legendComparacion').innerHTML = '';
  } else {
    compEmpty.style.display = 'none';
    const compRows = allCats.slice(0, 6).map((cat) => ({
      label: cat,
      bars: [
        { value: totalsCurr[cat] || 0, color: 'var(--series-1)', seriesLabel: 'Este mes' },
        { value: totalsPrev[cat] || 0, color: 'var(--series-other)', seriesLabel: 'Mes pasado' },
      ],
    }));
    renderHBarChart(compContainer, compRows, { labelWidth: 90, symbol: sym });
    renderLegend(document.getElementById('legendComparacion'), [
      { color: 'var(--series-1)', label: 'Este mes' },
      { color: 'var(--series-other)', label: 'Mes pasado' },
    ]);
  }

  const moversEmpty = document.getElementById('listaMoversEmpty');
  const moversList = document.getElementById('listaMovers');
  const movers = allCats
    .map((cat) => {
      const curr = totalsCurr[cat] || 0;
      const prev = totalsPrev[cat] || 0;
      const delta = curr - prev;
      const deltaPct = prev > 0 ? (delta / prev) * 100 : (curr > 0 ? 100 : 0);
      return { cat, delta, deltaPct };
    })
    .filter((m) => Math.abs(m.delta) > 0.5)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 5);
  if (movers.length === 0) {
    moversList.innerHTML = '';
    moversEmpty.style.display = 'block';
  } else {
    moversEmpty.style.display = 'none';
    moversList.innerHTML = movers.map((m) => `
      <li>
        <span class="mover-name">${esc(m.cat)}</span>
        <span class="mover-delta ${m.delta >= 0 ? 'mover-up' : 'mover-down'}">
          ${m.delta >= 0 ? '+' : ''}${fmtMoney(m.delta, sym)} (${m.delta >= 0 ? '+' : ''}${m.deltaPct.toFixed(0)}%)
        </span>
      </li>`).join('');
  }

  const gastosParaTendencia = filters.categoria ? gastos.filter((g) => g.categoria === filters.categoria) : gastos;
  const gastosPorMesKey = sumBy(gastosParaTendencia, (g) => monthKey(g.fecha), (g) => Number(g[field] || 0));
  const ingresosPorMesKey = sumBy(ingresos, (i) => monthKey(i.fecha), (i) => Number(i[field] || 0));
  delete gastosPorMesKey.null; delete ingresosPorMesKey.null;
  const monthKeys = [...new Set([...Object.keys(gastosPorMesKey), ...Object.keys(ingresosPorMesKey)])].sort().slice(-6);
  const tendEmpty = document.getElementById('chartTendenciaEmpty');
  const tendContainer = document.getElementById('chartTendencia');
  if (monthKeys.length < 2) {
    tendContainer.innerHTML = '';
    tendEmpty.style.display = 'block';
    document.getElementById('legendTendencia').innerHTML = '';
  } else {
    tendEmpty.style.display = 'none';
    const tendCols = monthKeys.map((k) => ({
      label: monthKeyLabel(k),
      bars: [
        { value: ingresosPorMesKey[k] || 0, color: 'var(--series-1)', seriesLabel: 'Ingreso' },
        { value: gastosPorMesKey[k] || 0, color: 'var(--series-8)', seriesLabel: 'Gasto' },
      ],
    }));
    renderGroupedColChart(tendContainer, tendCols, { symbol: sym });
    renderLegend(document.getElementById('legendTendencia'), [
      { color: 'var(--series-1)', label: 'Ingreso' },
      { color: 'var(--series-8)', label: 'Gasto' },
    ]);
  }

  const topHormiga = gastosMesActualFijo
    .filter((g) => Number(g.hormigaFlag) === 1)
    .sort((a, b) => Number(b[field] || 0) - Number(a[field] || 0))
    .slice(0, 8);
  document.querySelector('#tablaHormiga tbody').innerHTML = topHormiga
    .map((g) => `<tr><td>${esc(g.fecha)}</td><td>${esc(g.categoria)}</td><td>${esc(g.descripcion)}</td><td>${fmtMoney(g[field], sym)}</td></tr>`)
    .join('');
}

function renderCodabi() {
  const sym = filters.currency;
  const field = montoField();
  const gastosCodabi = state.gastos.filter((g) => String(g.categoria || '').toUpperCase() === 'CODABI');
  const ingresosCodabi = state.ingresos.filter((i) => String(i.medio || '').toUpperCase() === 'CODABI');

  const totalGastos = gastosCodabi.reduce((s, g) => s + Number(g[field] || 0), 0);
  const totalIngresos = ingresosCodabi.reduce((s, i) => s + Number(i[field] || 0), 0);

  document.getElementById('codabiGastos').textContent = fmtMoney(totalGastos, sym);
  document.getElementById('codabiIngresos').textContent = fmtMoney(totalIngresos, sym);
  document.getElementById('codabiBalance').textContent = fmtMoney(totalIngresos - totalGastos, sym);

  const gastosPorMes = sumBy(gastosCodabi, (g) => g.mes, (g) => Number(g[field] || 0));
  const ingresosPorMes = sumBy(ingresosCodabi, (i) => i.mes, (i) => Number(i[field] || 0));
  const meses = [...new Set([...Object.keys(gastosPorMes), ...Object.keys(ingresosPorMes)])]
    .sort((a, b) => MESES.indexOf(a) - MESES.indexOf(b));

  const mesesActivos = Math.max(1, meses.length);
  const margenNeto = totalIngresos > 0 ? ((totalIngresos - totalGastos) / totalIngresos) * 100 : (totalGastos > 0 ? -100 : 0);
  const cobertura = totalGastos > 0 ? totalIngresos / totalGastos : null;

  document.getElementById('codabiMargen').textContent = `${margenNeto.toFixed(1)}%`;
  document.getElementById('codabiCobertura').textContent = cobertura === null ? '—' : `${cobertura.toFixed(1)}x`;
  document.getElementById('codabiIngresoProm').textContent = fmtMoney(totalIngresos / mesesActivos, sym);
  document.getElementById('codabiGastoProm').textContent = fmtMoney(totalGastos / mesesActivos, sym);

  const badge = document.getElementById('codabiSaludBadge');
  if (margenNeto >= 40) { badge.textContent = 'Excelente'; badge.className = 'health-badge good'; }
  else if (margenNeto >= 15) { badge.textContent = 'Saludable'; badge.className = 'health-badge good'; }
  else if (margenNeto >= 0) { badge.textContent = 'Ajustado'; badge.className = 'health-badge warning'; }
  else { badge.textContent = 'Crítico'; badge.className = 'health-badge critical'; }

  const mesActualN = MESES[new Date().getMonth()];
  const mesPrevioN = mesAnteriorNombre();
  const ingresoMesActualCodabi = ingresosCodabi.filter((i) => i.mes === mesActualN).reduce((s, i) => s + Number(i[field] || 0), 0);
  const ingresoMesAnteriorCodabi = ingresosCodabi.filter((i) => i.mes === mesPrevioN).reduce((s, i) => s + Number(i[field] || 0), 0);
  let variacionCodabi = 0;
  if (ingresoMesAnteriorCodabi > 0) variacionCodabi = ((ingresoMesActualCodabi - ingresoMesAnteriorCodabi) / ingresoMesAnteriorCodabi) * 100;
  else if (ingresoMesActualCodabi > 0) variacionCodabi = 100;
  document.getElementById('codabiVariacion').textContent = `${variacionCodabi >= 0 ? '+' : ''}${variacionCodabi.toFixed(1)}%`;
  document.getElementById('codabiVariacionCard').className = `card ${variacionCodabi >= 0 ? 'card-delta-down' : 'card-delta-up'}`;

  const balanceEmpty = document.getElementById('chartCodabiBalanceEmpty');
  const balanceContainer = document.getElementById('chartCodabiBalance');
  if (meses.length === 0) {
    balanceContainer.innerHTML = '';
    balanceEmpty.style.display = 'block';
  } else {
    balanceEmpty.style.display = 'none';
    renderDivergingColChart(balanceContainer, meses.map((mes) => ({
      label: mes, value: (ingresosPorMes[mes] || 0) - (gastosPorMes[mes] || 0),
    })), { symbol: sym });
  }

  const chartEmpty = document.getElementById('chartCodabiEmpty');
  const chartContainer = document.getElementById('chartCodabi');
  if (meses.length === 0) {
    chartContainer.innerHTML = '';
    chartEmpty.style.display = 'block';
    document.getElementById('legendCodabi').innerHTML = '';
  } else {
    chartEmpty.style.display = 'none';
    const rows = meses.map((mes) => ({
      label: mes,
      bars: [
        { value: ingresosPorMes[mes] || 0, color: 'var(--series-1)', seriesLabel: 'Ingreso' },
        { value: gastosPorMes[mes] || 0, color: 'var(--series-8)', seriesLabel: 'Gasto' },
      ],
    }));
    renderHBarChart(chartContainer, rows, { labelWidth: 80, symbol: sym });
    renderLegend(document.getElementById('legendCodabi'), [
      { color: 'var(--series-1)', label: 'Ingreso' },
      { color: 'var(--series-8)', label: 'Gasto' },
    ]);
  }

  const movimientos = [
    ...gastosCodabi.map((g) => ({ ...g, tipo: 'Gasto', detalle: g.descripcion || g.categoria, signo: -1 })),
    ...ingresosCodabi.map((i) => ({ ...i, tipo: 'Ingreso', detalle: i.cliente || i.medio, signo: 1 })),
  ].sort((a, b) => parseFechaSheet(b.fecha) - parseFechaSheet(a.fecha));

  document.querySelector('#tablaCodabi tbody').innerHTML = movimientos
    .map((m) => `<tr><td>${esc(m.fecha)}</td><td>${esc(m.tipo)}</td><td>${esc(m.detalle)}</td><td>${fmtMoney(m.signo * m[field], sym)}</td></tr>`)
    .join('');
}

async function cargarConfig() {
  const cfg = await api('/config');
  document.querySelector('#formConfig [name=tipoCambio]').value = cfg.tipoCambio;
}

function mostrarMensaje(el, texto, ok) {
  el.textContent = texto;
  el.className = `form-msg ${ok ? 'ok' : 'error'}`;
}

document.getElementById('formGasto').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const msg = document.getElementById('msgGasto');
  const data = Object.fromEntries(new FormData(form).entries());
  data.esHormiga = form.esHormiga.checked;
  try {
    await api('/gastos', { method: 'POST', body: JSON.stringify(data) });
    mostrarMensaje(msg, 'Gasto guardado', true);
    form.reset();
    await cargarTodo();
  } catch (err) {
    mostrarMensaje(msg, err.message, false);
  }
});

document.getElementById('formIngreso').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const msg = document.getElementById('msgIngreso');
  const data = Object.fromEntries(new FormData(form).entries());
  try {
    await api('/ingresos', { method: 'POST', body: JSON.stringify(data) });
    mostrarMensaje(msg, 'Ingreso guardado', true);
    form.reset();
    await cargarTodo();
  } catch (err) {
    mostrarMensaje(msg, err.message, false);
  }
});

document.getElementById('formConfig').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const msg = document.getElementById('msgConfig');
  const data = Object.fromEntries(new FormData(form).entries());
  try {
    await api('/config', { method: 'POST', body: JSON.stringify(data) });
    mostrarMensaje(msg, 'Configuración guardada', true);
  } catch (err) {
    mostrarMensaje(msg, err.message, false);
  }
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js').catch(() => {});
}

cargarConfig();
cargarTodo();
setInterval(cargarTodo, 20000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') cargarTodo();
});
