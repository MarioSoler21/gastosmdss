const express = require('express');
const { appendRow, getRows, INGRESOS_SHEET } = require('../sheets');
const { getMesYSemana, normalizeFecha } = require('../utils/dateHelpers');
const { calcularMontos } = require('../utils/currency');
const { getConfig } = require('../config');

const router = express.Router();

const COLUMNAS = [
  'fecha', 'medio', 'cliente', 'moneda', 'monto',
  'montoRealL', 'montoUSD', 'mes', 'semana',
];

router.get('/', async (req, res) => {
  try {
    const rows = await getRows(INGRESOS_SHEET);
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
    const { fecha, medio, cliente, moneda, monto } = req.body;

    if (!fecha || !medio || !moneda || monto === undefined) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const { tipoCambio } = getConfig();
    const { montoRealL, montoUSD } = calcularMontos(moneda, monto, tipoCambio);
    const { mes, semana } = getMesYSemana(fecha);

    await appendRow(INGRESOS_SHEET, [
      fecha, medio, cliente || '', moneda, Number(monto),
      montoRealL, montoUSD, mes, semana,
    ]);

    res.status(201).json({ ok: true, mes, semana, montoRealL, montoUSD });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
