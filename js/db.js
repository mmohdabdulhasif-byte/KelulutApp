/**
 * db.js - Dikemaskini dengan fungsi getAll()
 */
(function(window){
  const DB_NAME = "KelulutDB";
  const DB_VERSION = 1;
  const STORES = ["colonies","harvests","sales","invoices","inventory","careLogs"];

  const openDB = () => {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        for (const s of STORES) {
          if (!db.objectStoreNames.contains(s)) {
            db.createObjectStore(s, { keyPath: "id" });
          }
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  };

  const promisifyRequest = (req) => {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  };

  const genId = () => {
    return `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
  };

  const runTx = async (storeName, mode, cb) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      let result;
      try {
        result = cb(store);
      } catch (err) {
        reject(err);
      }
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
    });
  };

  const api = {
    init: async function(){
      await openDB();
      return true;
    },

    add: async function(storeName, item){
      if (!STORES.includes(storeName)) throw new Error("Invalid store: "+storeName);
      if (!item.id) item.id = genId();
      const now = new Date().toISOString();
      item.createdAt = item.createdAt || now;
      item.updatedAt = now;
      await runTx(storeName, "readwrite", (store) => {
        store.add(item);
      });
      return item.id;
    },

    put: async function(storeName, item){
      if (!STORES.includes(storeName)) throw new Error("Invalid store: "+storeName);
      if (!item.id) item.id = genId();
      item.updatedAt = new Date().toISOString();
      await runTx(storeName, "readwrite", (store) => {
        store.put(item);
      });
      return item.id;
    },

    get: async function(storeName, id){
      if (!STORES.includes(storeName)) throw new Error("Invalid store: "+storeName);
      return runTx(storeName, "readonly", (store) => {
        const req = store.get(id);
        return promisifyRequest(req);
      });
    },

    getAll: async function(storeName){
      if (!STORES.includes(storeName)) throw new Error("Invalid store: "+storeName);
      return runTx(storeName, "readonly", (store) => {
        const req = store.getAll();
        return promisifyRequest(req);
      });
    },

    delete: async function(storeName, id){
      if (!STORES.includes(storeName)) throw new Error("Invalid store: "+storeName);
      await runTx(storeName, "readwrite", (store) => {
        store.delete(id);
      });
      return true;
    },

    clear: async function(storeName){
      if (!STORES.includes(storeName)) throw new Error("Invalid store: "+storeName);
      await runTx(storeName, "readwrite", (store) => {
        store.clear();
      });
      return true;
    },

    exportAll: async function(){
      const out = {};
      for (const s of STORES){
        out[s] = await this.getAll(s);
      }
      return out;
    },

    importAll: async function(obj){
      for (const s of STORES){
        if (Array.isArray(obj[s])){
          for (const item of obj[s]){
            if (!item.id) item.id = genId();
            await this.put(s, item);
          }
        }
      }
      return true;
    }
  };

  // Expose functions globally for backward compatibility
  window.db = api;
  window.getAll = (storeName) => db.getAll(storeName);
  window.addRecord = (storeName, item) => db.add(storeName, item);
  window.deleteRecord = (storeName, id) => db.delete(storeName, id);

})(window);