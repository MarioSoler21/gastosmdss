function calcularMontos(moneda, monto, tipoCambio) {
  const montoNum = Number(monto);
  const esLempiras = moneda === 'L';

  const montoRealL = esLempiras ? montoNum : montoNum * tipoCambio;
  const montoUSD = esLempiras ? montoNum / tipoCambio : montoNum;

  return {
    montoRealL: Math.round(montoRealL * 100) / 100,
    montoUSD: Math.round(montoUSD * 100) / 100,
  };
}

module.exports = { calcularMontos };
