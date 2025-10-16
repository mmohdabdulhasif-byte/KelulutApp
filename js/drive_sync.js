// drive_sync.js - export/import backup and Google Drive upload (works in Safari tab, not PWA standalone)
(async function(){
  const statusEl = id => document.getElementById(id);
  const status = s => { const el = document.getElementById('status'); if(el) el.textContent = s; console.log(s); };
  const inStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
  if(inStandalone) status('PWA standalone: Drive sync disabled. Open in Safari to use Drive features.');

  function collectData(){
    const sales = localStorage.getItem('kelulut_sales_v1') || '[]';
    const other = {};
    for(let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i);
      if(k && k.startsWith('kelulut_') && k !== 'kelulut_sales_v1') other[k] = localStorage.getItem(k);
    }
    return { sales: JSON.parse(sales), other };
  }

  function readAllAttachments(){
    return new Promise((resolve)=>{
      const req = indexedDB.open('kelulut_attachments_db',1);
      req.onsuccess = e => {
        const db = e.target.result;
        const tx = db.transaction('attachments_v1','readonly');
        const store = tx.objectStore('attachments_v1');
        const all = store.getAll();
        all.onsuccess = ()=> resolve(all.result || []);
        all.onerror = ()=> resolve([]);
      };
      req.onerror = ()=> resolve([]);
    });
  }

  async function makeZip(){
    const zip = new JSZip();
    const data = collectData();
    zip.file('data.json', JSON.stringify(data));
    const atts = await readAllAttachments();
    const af = zip.folder('attachments');
    for(const a of atts){
      try{
        const blob = new Blob([a.data]);
        const arr = new Uint8Array(await blob.arrayBuffer());
        af.file(a.id + '_' + a.filename, arr);
      }catch(e){ console.warn(e); }
    }
    return await zip.generateAsync({ type: 'blob' });
  }

  document.getElementById('btnExportZip').addEventListener('click', async ()=>{
    status('Menyediakan ZIP...');
    const blob = await makeZip();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = (document.getElementById('backupPrefix').value||'kelulut_backup_')+Date.now()+'.zip'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    status('ZIP dieksport ke Files/Downloads.');
  });

  // Google Drive token client flow (requires accounts.google.com gsi client)
  let tokenClient = null, accessToken = null;
  document.getElementById('btnSignIn').addEventListener('click', ()=>{
    const clientId = document.getElementById('gClientId').value.trim();
    if(!clientId){ alert('Masukkan Client ID'); return; }
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (resp) => {
        if(resp.error) status('Token error: '+resp.error); else { accessToken = resp.access_token; status('Signed in.'); }
      }
    });
    tokenClient.requestAccessToken();
  });

  async function uploadToDrive(blob, filename){
    if(!accessToken){ alert('Sign in first'); return; }
    const metadata = { name: filename, mimeType: 'application/zip' };
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";
    const reader = new FileReader();
    const base64 = await new Promise((resolve,reject)=>{ reader.onload = ()=> resolve(reader.result.split(',')[1]); reader.onerror = reject; reader.readAsDataURL(blob); });
    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/zip\r\n' +
      'Content-Transfer-Encoding: base64\r\n\r\n' +
      base64 +
      close_delim;
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: new Headers({'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'multipart/related; boundary="' + boundary + '"'}),
      body: multipartRequestBody
    });
    return res.json();
  }

  document.getElementById('btnBackup').addEventListener('click', async ()=>{
    if(inStandalone){ alert('Open in Safari to use Drive sync.'); return; }
    const clientId = document.getElementById('gClientId').value.trim();
    if(!clientId){ alert('Enter client id'); return; }
    if(!tokenClient){
      tokenClient = google.accounts.oauth2.initTokenClient({ client_id: clientId, scope: 'https://www.googleapis.com/auth/drive.file', callback: (resp)=>{ if(resp.error) status('Token error'); else { accessToken = resp.access_token; status('Signed in'); } } });
    }
    if(!accessToken){ tokenClient.requestAccessToken(); await new Promise(r=>setTimeout(r,1000)); if(!accessToken){ status('No token'); return; } }
    status('Membuat ZIP backup...');
    const blob = await makeZip();
    const fname = (document.getElementById('backupPrefix').value||'kelulut_backup_') + Date.now() + '.zip';
    status('Meng-upload ke Google Drive sebagai ' + fname);
    try{ const res = await uploadToDrive(blob, fname); status('Backup berjaya. File ID: ' + (res.id || 'unknown')); }catch(e){ status('Upload failed: '+(e.message||e)); }
  });

  document.getElementById('btnRestore').addEventListener('click', async ()=>{
    if(inStandalone){ alert('Open in Safari to restore'); return; }
    if(!accessToken){ alert('Sign in first'); return; }
    const prefix = (document.getElementById('backupPrefix').value||'kelulut_backup_');
    status('Mencari backup di Drive...');
    const q = `name contains '${prefix}'`;
    const listRes = await fetch('https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(q) + '&fields=files(id,name,modifiedTime)', { headers: { 'Authorization': 'Bearer ' + accessToken } });
    const j = await listRes.json();
    if(!j.files || j.files.length===0){ status('Tiada backup ditemui.'); return; }
    j.files.sort((a,b)=> new Date(b.modifiedTime)-new Date(a.modifiedTime));
    const file = j.files[0];
    status('Memuat turun ' + file.name);
    const dl = await fetch('https://www.googleapis.com/drive/v3/files/' + file.id + '?alt=media', { headers: { 'Authorization': 'Bearer ' + accessToken }});
    const blob = await dl.blob();
    status('Menerap data backup...');
    const z = await JSZip.loadAsync(blob);
    const dataJson = await z.file('data.json').async('string');
    const data = JSON.parse(dataJson);
    if(data.sales) localStorage.setItem('kelulut_sales_v1', JSON.stringify(data.sales));
    if(data.other) { Object.keys(data.other).forEach(k=> localStorage.setItem(k, data.other[k])); }
    const atts = z.folder('attachments');
    if(atts){
      const files = Object.keys(atts.files);
      for(const fname of files){
        const f = atts.files[fname];
        const arr = await f.async('uint8array');
        const parts = fname.split('_');
        const id = parts.shift();
        const filename = parts.join('_');
        try{ await AttachDB.saveAttachment(id, filename, 'application/octet-stream', arr.buffer); }catch(e){}
      }
    }
    status('Restore lengkap. Refresh app.');
    alert('Restore selesai. Sila refresh halaman utama.');
  });

})();