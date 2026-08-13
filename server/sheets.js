const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const GASTOS_SHEET = process.env.GASTOS_SHEET_NAME || 'Gastos';
const INGRESOS_SHEET = process.env.INGRESOS_SHEET_NAME || 'Ingresos';

let sheetsClient = null;

function buildAuth() {
  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];

  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    return new google.auth.GoogleAuth({ credentials, scopes });
  }

  return new google.auth.GoogleAuth({ keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS, scopes });
}

async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  const auth = buildAuth();
  const authClient = await auth.getClient();
  sheetsClient = google.sheets({ version: 'v4', auth: authClient });
  return sheetsClient;
}

async function appendRow(sheetName, values) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [values] },
  });
}

async function getRows(sheetName) {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A2:Z`,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  return res.data.values || [];
}

module.exports = {
  appendRow,
  getRows,
  GASTOS_SHEET,
  INGRESOS_SHEET,
};
