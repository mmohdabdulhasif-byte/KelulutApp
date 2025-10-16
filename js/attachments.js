// attachments.js - IndexedDB helper for storing attachments (resit)
const AttachDB = (function(){
  const DB_NAME = 'kelulut_attachments_db';
  const STORE = 'attachments_v1';
  let db = null;
  function openDB(){
    return new Promise((resolve,reject)=>{
      if(db) return resolve(db);
      const req = indexedDB.open(DB_NAME,1);
      req.onupgradeneeded = e => {
        const d = e.target.result;
        if(!d.objectStoreNames.contains(STORE)){
          d.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = e => { db = e.target.result; resolve(db); };
      req.onerror = e => reject(e.target.error);
    });
  }
  async function saveAttachment(id, filename, mime, arrayBuffer){
    const d = await openDB();
    return new Promise((resolve,reject)=>{
      const tx = d.transaction(STORE,'readwrite');
      const store = tx.objectStore(STORE);
      const obj = { id, filename, mime, data: arrayBuffer, created: Date.now() };
      const req = store.put(obj);
      req.onsuccess = ()=> resolve(true);
      req.onerror = e=> reject(e.target.error);
    });
  }
  async function getAttachment(id){
    const d = await openDB();
    return new Promise((resolve,reject)=>{
      const tx = d.transaction(STORE,'readonly');
      const store = tx.objectStore(STORE);
      const req = store.get(id);
      req.onsuccess = e=> resolve(e.target.result);
      req.onerror = e=> reject(e.target.error);
    });
  }
  async function getAll(){
    const d = await openDB();
    return new Promise((resolve,reject)=>{
      const tx = d.transaction(STORE,'readonly');
      const store = tx.objectStore(STORE);
      const req = store.getAll();
      req.onsuccess = e=> resolve(e.target.result);
      req.onerror = e=> reject(e.target.error);
    });
  }
  async function deleteAttachment(id){
    const d = await openDB();
    return new Promise((resolve,reject)=>{
      const tx = d.transaction(STORE,'readwrite');
      const store = tx.objectStore(STORE);
      const req = store.delete(id);
      req.onsuccess = ()=> resolve(true);
      req.onerror = e=> reject(e.target.error);
    });
  }
  return { saveAttachment, getAttachment, getAll, deleteAttachment };
})();