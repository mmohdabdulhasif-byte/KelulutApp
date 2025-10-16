/**
 * main.js
 * UI bindings, CRUD functions for SPA and Google Drive integration hooks.
 *
 * Requirements:
 * - index.html contains sections with ids: dashboard, colonies, harvests, care, reports, sales, inventory, invoices, charts
 * - Mount points for lists: #coloniesList, #harvestsList, #salesList, #inventoryList, #invoicesList
 * - Buttons/forms you create should call the provided functions (e.g., saveColony)
 *
 * This file keeps Google Drive functions: manualConnect, manualBackup, manualRestore, manualSignOut.
 * Ensure CLIENT_ID is set below to your GCP OAuth client if you want Drive integration.
 */

(function(window){
  // CONFIG: set your CLIENT_ID here (same as in index.html if duplicated)
  const CLIENT_ID = "253249814475-79vie8d9ovh5evmh6ra69q01ot8g5rd6.apps.googleusercontent.com"; // replace if needed
  const SCOPES = "https://www.googleapis.com/auth/drive.file";

  // internal state
  let accessToken = null;
  let tokenClient = null;
  let autoBackupTimer = null;

  // ---- Google Identity & Drive helpers (kept as requested) ----
  async function initGIS(){
    return new Promise((resolve,reject)=>{
      try {
        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: (resp) => {
            if (resp && resp.access_token) {
              accessToken = resp.access_token;
              notify("✅ Disambung ke Google Drive", "success");
              resolve(accessToken);
            } else {
              reject(new Error("No token"));
            }
          }
        });
        resolve(true); // tokenClient ready
      } catch (err){
        reject(err);
      }
    });
  }

  async function manualConnect(){
    try {
      if (!tokenClient) await initGIS();
      tokenClient.requestAccessToken();
      // token arrives in callback; UI updated there
      setTimeout(()=> {
        if (accessToken){
          updateDriveStatus(true);
        } else {
          notify("❌ Gagal sambung ke Google Drive", "error");
        }
      }, 800);
    } catch (err){
      console.error(err);
      notify("❌ GIS init error: " + err.message, "error");
    }
  }

  function manualSignOut(){
    accessToken = null;
    updateDriveStatus(false);
    notify("👋 Log keluar dari Google Drive", "info");
  }

  async function ensureBackupFolder() {
    // Create folder Kelulut_Backup if not exists. Uses Drive v3 API.
    const q = "name='Kelulut_Backup' and mimeType='application/vnd.google-apps.folder' and trashed=false";
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}`, {
      headers: { Authorization: "Bearer " + accessToken }
    });
    const data = await res.json();
    if (data.files && data.files.length>0) return data.files[0].id;

    const create = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Kelulut_Backup", mimeType: "application/vnd.google-apps.folder" })
    });
    const folder = await create.json();
    return folder.id;
  }

  async function manualBackup(){
    try {
      if (!accessToken) return notify("⚠️ Sila sambungkan Google Drive dahulu", "error");
      notify("📦 Sedang backup data ke Drive...", "info");
      const all = await db.exportAll();
      const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
      const folderId = await ensureBackupFolder();
      const metadata = { name: `kelulut_backup_${Date.now()}.json`, parents: [folderId] };

      const form = new FormData();
      form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
      form.append("file", blob, "kelulut_backup.json");

      const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: { Authorization: "Bearer " + accessToken },
        body: form
      });
      const result = await res.json();
      notify("✅ Backup berjaya!", "success");
      console.log("Backup result:", result);
    } catch (err){
      console.error(err);
      notify("❌ Backup gagal: " + (err.message || err), "error");
    }
  }

  async function manualRestore(){
    try {
      if (!accessToken) return notify("⚠️ Sila sambungkan Google Drive dahulu", "error");
      notify("🔄 Mencari backup di Drive...", "info");
      const q = "name contains 'kelulut_backup' and trashed=false";
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: "Bearer " + accessToken }
      });
      const data = await res.json();
      if (!data.files || data.files.length===0) return notify("❌ Tiada backup dijumpai", "error");

      // pick the latest file by id (Drive doesn't guarantee order, but we'll request the first)
      const fileId = data.files[0].id;
      const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: "Bearer " + accessToken }
      });
      const text = await fileRes.text();
      const parsed = JSON.parse(text);
      // Import into IndexedDB (careful: merge)
      await db.importAll(parsed);
      notify("✅ Data dipulihkan dari Drive", "success");
      // re-render lists
      await renderAllLists();
    } catch (err){
      console.error(err);
      notify("❌ Restore gagal: " + (err.message || err), "error");
    }
  }

  function updateDriveStatus(connected){
    const el = document.getElementById("driveStatus");
    if (!el) return;
    el.textContent = connected ? "Drive: Connected ✅" : "Drive: Disconnected ❌";
    el.className = connected ? "status-connected" : "status-disconnected";
  }

  // notification helper (same style as index)
  function notify(msg, type="info"){
    const box = document.getElementById("notifyBox");
    if (!box) return;
    const div = document.createElement("div");
    div.className = `notify ${type}`;
    div.textContent = msg;
    box.appendChild(div);
    setTimeout(()=> div.classList.add("show"), 50);
    setTimeout(()=> {
      div.classList.remove("show");
      setTimeout(()=> div.remove(), 300);
    }, 3500);
  }

  // Auto-backup trigger after data change
  function triggerAutoBackup(){
    if (!accessToken) return;
    if (autoBackupTimer) clearTimeout(autoBackupTimer);
    autoBackupTimer = setTimeout(()=> {
      manualBackup();
    }, 5000); // 5s debounce
  }

  // ---- UI / CRUD for colonies, harvests, sales, inventory, invoices ----
  async function renderColonies(){
    const listEl = document.getElementById("coloniesList");
    if (!listEl) return;
    const items = await db.getAll("colonies");
    listEl.innerHTML = "";
    if (!items.length) {
      listEl.innerHTML = "<div class='empty'>Tiada koloni. Tambah baru.</div>";
      return;
    }
    for (const item of items){
      const row = document.createElement("div");
      row.className = "row item";
      row.innerHTML = `
        <strong>${escapeHtml(item.name || "(tiada nama)")}</strong>
        <div>${escapeHtml(item.notes || "")}</div>
        <div style="margin-top:6px">
          <button onclick="saveColonyForm('${item.id}')">Edit</button>
          <button onclick="deleteColony('${item.id}')">Padam</button>
        </div>
      `;
      listEl.appendChild(row);
    }
  }

  // Save colony via form values (form fields expected: #colonyName, #colonyNotes)
  async function saveColony(){
    const nameEl = document.getElementById("colonyName");
    const notesEl = document.getElementById("colonyNotes");
    if (!nameEl) return notify("Form koloni tak dijumpai", "error");
    const name = nameEl.value.trim();
    const notes = notesEl.value.trim();
    if (!name) return notify("Sila masukkan nama koloni", "error");
    const item = { name, notes };
    await db.add("colonies", item);
    notify("✅ Koloni disimpan", "success");
    nameEl.value = ""; notesEl.value = "";
    await renderColonies();
    triggerAutoBackup();
  }

  // Prefill form to edit (simple approach: load item into form and delete old then save new)
  async function saveColonyForm(id){
    const item = await db.get("colonies", id);
    if (!item) return notify("Koloni tidak ditemui", "error");
    // show prompt edits (simpler than building modal)
    const newName = prompt("Nama Koloni:", item.name) || item.name;
    const newNotes = prompt("Catatan:", item.notes || "") || item.notes;
    item.name = newName; item.notes = newNotes;
    await db.put("colonies", item);
    notify("✅ Koloni dikemaskini", "success");
    await renderColonies();
    triggerAutoBackup();
  }

  async function deleteColony(id){
    if (!confirm("Padam rekod koloni ini?")) return;
    await db.delete("colonies", id);
    notify("❌ Koloni dipadam", "info");
    await renderColonies();
    triggerAutoBackup();
  }

  // Generic render functions for other stores (harvests, sales, inventory, invoices)
  async function renderGenericList(storeName, containerId, fields){
    const el = document.getElementById(containerId);
    if (!el) return;
    const items = await db.getAll(storeName);
    el.innerHTML = "";
    if (!items.length) { el.innerHTML = "<div class='empty'>Tiada data.</div>"; return; }
    for (const item of items){
      const row = document.createElement("div");
      row.className = "row item";
      let html = `<strong>${escapeHtml(item.title || item.name || item.id)}</strong>`;
      if (fields && fields.length){
        for (const f of fields){
          html += `<div>${escapeHtml(item[f]||"")}</div>`;
        }
      } else {
        html += `<div>${escapeHtml(JSON.stringify(item))}</div>`;
      }
      html += `<div style="margin-top:6px">
        <button onclick="editGeneric('${storeName}','${item.id}')">Edit</button>
        <button onclick="deleteGeneric('${storeName}','${item.id}')">Padam</button>
      </div>`;
      row.innerHTML = html;
      el.appendChild(row);
    }
  }

  async function editGeneric(storeName, id){
    const item = await db.get(storeName, id);
    if (!item) return notify("Item tidak ditemui", "error");
    // Simple edit via prompt for JSON - advanced UI can be added later
    const txt = prompt("Ubah data (JSON):", JSON.stringify(item, null, 2));
    if (!txt) return;
    try {
      const parsed = JSON.parse(txt);
      parsed.id = id; // ensure id consistent
      await db.put(storeName, parsed);
      notify("✅ Dikemaskini", "success");
      await renderAllLists();
      triggerAutoBackup();
    } catch (err){
      notify("JSON tidak sah", "error");
    }
  }

  async function deleteGeneric(storeName, id){
    if (!confirm("Padam rekod?")) return;
    await db.delete(storeName, id);
    notify("❌ Dipadam", "info");
    await renderAllLists();
    triggerAutoBackup();
  }

  async function renderAllLists(){
    await renderColonies();
    // attempt to render other lists if containers exist
    await renderGenericList("harvests", "harvestsList", ["date","amount"]);
    await renderGenericList("sales", "salesList", ["date","total"]);
    await renderGenericList("inventory", "inventoryList", ["qty","name"]);
    await renderGenericList("invoices", "invoicesList", ["date","total"]);
  }

  // helper escape
  function escapeHtml(str){
    if (typeof str !== "string") return str;
    return str.replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  // Expose some functions globally so index.html buttons can call them
  window.saveColony = saveColony;
  window.saveColonyForm = saveColonyForm;
  window.deleteColony = deleteColony;
  window.editGeneric = editGeneric;
  window.deleteGeneric = deleteGeneric;
  window.manualConnect = manualConnect;
  window.manualBackup = manualBackup;
  window.manualRestore = manualRestore;
  window.manualSignOut = manualSignOut;
  window.renderAllLists = renderAllLists;

  // Init on DOM ready
  window.addEventListener("DOMContentLoaded", async () => {
    try {
      await db.init();
    } catch (err){
      console.warn("DB init failed:", err);
    }
    // Render lists if containers present
    await renderAllLists();

    // Hook up simple add-colony form if exists
    const addColonyBtn = document.getElementById("addColonyBtn");
    if (addColonyBtn){
      addColonyBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        saveColony();
      });
    }

    // If google api loaded, init token client (but do not request token until user clicks)
    if (window.google && window.google.accounts && !tokenClient){
      try { await initGIS(); } catch(e){ console.warn("GIS init:", e); }
    }
  });

})(window);