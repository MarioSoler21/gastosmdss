const express = require('express');
const { appendRow, getRows, GASTOS_SHEET } = require('../sheets');
const { getMesYSemana, normalizeFecha } = require('../utils/dateHelpers');
const { calcularMontos } = require('../utils/currency');
const { getConfig } = require('../config');

const router = express.Router();

const COLUMNAS = [
  'fecha', 'cuenta', 'categoria', 'descripcion', 'moneda', 'monto',
  'montoRealL', 'montoUSD', 'mes', 'semana', 'hormiga', 'hormigaFlag',
];

router.get('/', async (req, res) => {
  try {
    const rows = await getRows(GASTOS_SHEET);
    const data = rows.map((row) => {
      const obj = {};
      COLUMNAS.forEach((key, i) => { obj[key] = row[i] ?? ''; });
      obj.fecha = normalizeFecha(obj.fecha);
      return obj;
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { fecha, cuenta, categoria, descripcion, moneda, monto, esHormiga } = req.body;

    if (!fecha || !cuenta || !categoria || !moneda || monto === undefined) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const { tipoCambio } = getConfig();
    const { montoRealL, montoUSD } = calcularMontos(moneda, monto, tipoCambio);
    const { mes, semana } = getMesYSemana(fecha);
    const hormiga = esHormiga ? montoRealL : '';
    const hormigaFlag = esHormiga ? 1 : 0;

    await appendRow(GASTOS_SHEET, [
      fecha, cuenta, categoria, descripcion || '', moneda, Number(monto),
      montoRealL, montoUSD, mes, semana, hormiga, hormigaFlag,
    ]);

    res.status(201).json({ ok: true, mes, semana, montoRealL, montoUSD });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
