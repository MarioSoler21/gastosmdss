const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const DEFAULT_CONFIG = { tipoCambio: 24.7 };

function readConfigFile() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

function getConfig() {
  return readConfigFile() || DEFAULT_CONFIG;
}

function saveConfig(newConfig) {
  const merged = { ...getConfig(), ...newConfig };
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2));
  } catch {
    // Sistema de archivos de solo lectura (ej. Vercel serverless) - no persiste entre invocaciones.
  }
  return merged;
}

module.exports = { getConfig, saveConfig };
