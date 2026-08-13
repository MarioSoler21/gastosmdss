require('dotenv').config();
const express = require('express');

const gastosRouter = require('./routes/gastos');
const ingresosRouter = require('./routes/ingresos');
const configRouter = require('./routes/config');

const app = express();

if (!process.env.SPREADSHEET_ID) {
  console.warn('[AVISO] Falta SPREADSHEET_ID en las variables de entorno');
}

app.use(express.json());
app.use('/api/gastos', gastosRouter);
app.use('/api/ingresos', ingresosRouter);
app.use('/api/config', configRouter);

module.exports = app;
