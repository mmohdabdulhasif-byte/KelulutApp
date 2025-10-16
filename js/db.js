// === db.js ===
// An-Naas Kelulut Bekeng - Local Database (v2.2 - 2025)

const STORE_KEY = 'kelulut_data_v2';

// ====== UTILITIES ======
function readStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : defaultData();
  } catch (e) {
    console.error('readStore error:', e);
    return defaultData();
  }
}

function writeStore(obj) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(obj));
    localStorage.setItem('kelulut_lastUpdate', new Date().toISOString());
  } catch (e) {
    console.error('writeStore error:', e);
  }
}

function defaultData() {
  return { colonies: [], harvests: [], careLogs: [], sales: [], inventory: [], invoices: [] };
}

// ====== INITIALIZATION ======
async function initDB() {
  if (!localStorage.getItem(STORE_KEY)) {
    writeStore(defaultData());
    localStorage.setItem('kelulut_lastBackup', new Date(0).toISOString());
    console.log('Kelulut DB initialized');
  }
}

// ====== CRUD OPERATIONS ======
async function getAll(store) {
  const s = readStore();
  return s[store] || [];
}

async function insert(store, item) {
  const s = readStore();
  item.id = item.id || ('id' + Date.now());
  s[store] = s[store] || [];
  s[store].push(item);
  writeStore(s);
  return item;
}

async function update(store, id, changes) {
  const s = readStore();
  s[store] = s[store] || [];
  const idx = s[store].findIndex(x => x.id == id);
  if (idx === -1) return null;
  s[store][idx] = Object.assign({}, s[store][idx], changes);
  writeStore(s);
  return s[store][idx];
}

async function remove(store, id) {
  const s = readStore();
  s[store] = s[store] || [];
  s[store] = s[store].filter(x => x.id != id);
  writeStore(s);
}

// ====== EXPORT / IMPORT ======
async function exportAllData() {
  return JSON.stringify({ exportedAt: new Date().toISOString(), data: readStore() }, null, 2);
}

async function importData(jsonStr) {
  try {
    const obj = JSON.parse(jsonStr);
    if (obj.data) writeStore(obj.data);
    else writeStore(obj);
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

// ====== FOR GOOGLE DRIVE RESTORE ======
async function importAllData(raw) {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (parsed.data) writeStore(parsed.data);
    else writeStore(parsed);
    localStorage.setItem('kelulut_lastRestore', new Date().toISOString());
    return true;
  } catch (e) {
    console.error('importAllData error:', e);
    return false;
  }
}

// ====== EXPORT WINDOW ======
window.initDB = initDB;
window.getAll = getAll;
window.insert = insert;
window.update = update;
window.remove = remove;
window.exportAllData = exportAllData;
window.importData = importData;
window.importAllData = importAllData;