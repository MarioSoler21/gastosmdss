const path = require('path');
const express = require('express');
const app = require('./app');

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(PORT, () => {
  console.log(`Gastos MDSS corriendo en http://localhost:${PORT}`);
});
