const express = require('express');
const { getConfig, saveConfig } = require('../config');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(getConfig());
});

router.post('/', (req, res) => {
  const { tipoCambio } = req.body;
  if (!tipoCambio || Number(tipoCambio) <= 0) {
    return res.status(400).json({ error: 'Tipo de cambio inválido' });
  }
  const updated = saveConfig({ tipoCambio: Number(tipoCambio) });
  res.json(updated);
});

module.exports = router;
