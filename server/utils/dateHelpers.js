const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function getMesYSemana(fechaISO) {
  const fecha = new Date(`${fechaISO}T00:00:00`);
  const year = fecha.getFullYear();
  const month = fecha.getMonth();
  const day = fecha.getDate();

  const mes = MESES[month];

  const primerDiaSemana = new Date(year, month, 1).getDay();
  const primerDiaLunes = (primerDiaSemana + 6) % 7;
  const semanaNum = Math.ceil((day + primerDiaLunes) / 7);
  const semana = `Sem ${semanaNum}`;

  return { mes, semana };
}

const DIAS_ENTRE_EPOCA_SHEETS_Y_UNIX = 25569;

function serialToISO(serial) {
  const ms = (serial - DIAS_ENTRE_EPOCA_SHEETS_Y_UNIX) * 86400 * 1000;
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normalizeFecha(value) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'number') return serialToISO(value);
  return String(value);
}

module.exports = { getMesYSemana, normalizeFecha, MESES };
