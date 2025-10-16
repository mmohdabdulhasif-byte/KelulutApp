// === drive-backup.js ===
// An-Naas Kelulut Bekeng - Google Drive Backup & Restore
// v2.1 (2025)

const CLIENT_ID = '253249814475-79vie8d9ovh5evmh6ra69q01ot8g5rd6.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
let gapiInited = false, authInstance = null;

// ====== INIT GOOGLE API ======
async function initGapi() {
  return new Promise((resolve) => {
    if (gapiInited) return resolve();
    gapi.load('client:auth2', async () => {
      await gapi.client.init({ clientId: CLIENT_ID, scope: SCOPES });
      authInstance = gapi.auth2.getAuthInstance();
      gapiInited = true;
      updateDriveStatus();
      resolve();
    });
  });
}

// ====== STATUS ======
function isSignedIn() {
  return authInstance && authInstance.isSignedIn.get();
}

function updateDriveStatus() {
  const el = document.getElementById('driveStatus');
  if (!el) return;
  el.textContent = isSignedIn() ? 'Drive: Connected ✅' : 'Drive: Disconnected ❌';
  el.style.color = isSignedIn() ? '#34a853' : '#ff4444';
}

// ====== SIGN IN / OUT ======
async function signInAndInit() {
  await initGapi();
  try {
    if (!isSignedIn()) await authInstance.signIn();
    updateDriveStatus();
    localStorage.setItem('kelulut_lastLogin', new Date().toISOString());
  } catch (e) {
    console.error(e);
    alert('❌ Google Sign-In failed: ' + e.message);
  }
}

async function signOutDrive() {
  if (authInstance) {
    await authInstance.signOut();
    updateDriveStatus();
  }
}

// ====== FOLDER & UPLOAD ======
async function ensureBackupFolder() {
  const res = await gapi.client.drive.files.list({
    q: "name='Kelulut Management Backup' and mimeType='application/vnd.google-apps.folder' and trashed=false",
    fields: 'files(id,name)',
  });

  if (res.result.files.length > 0) return res.result.files[0].id;

  const create = await gapi.client.drive.files.create({
    resource: { name: 'Kelulut Management Backup', mimeType: 'application/vnd.google-apps.folder' },
    fields: 'id',
  });

  return create.result.id;
}

function createMultipart(boundary, metadata, content) {
  const delim = '\r\n--' + boundary + '\r\n';
  const close = '\r\n--' + boundary + '--';
  return (
    delim +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delim +
    'Content-Type: application/json\r\n\r\n' +
    content +
    close
  );
}

async function uploadToFolder(folderId, filename, content) {
  const boundary = '-------314159265358979323846';
  const metadata = {
    name: filename,
    parents: [folderId],
    mimeType: 'application/json',
  };
  const body = createMultipart(boundary, metadata, content);

  const res = await gapi.client.request({
    path: '/upload/drive/v3/files',
    method: 'POST',
    params: { uploadType: 'multipart' },
    headers: { 'Content-Type': 'multipart/related; boundary=' + boundary },
    body: body,
  });

  return res.result;
}

// ====== BACKUP NOW ======
async function performBackupNow() {
  try {
    await initGapi();
    if (!isSignedIn()) {
      alert('⚠️ Sila sambungkan Google Drive dahulu.');
      return { ok: false, error: 'not_signed_in' };
    }

    const folderId = await ensureBackupFolder();
    const json = await exportAllData(); // fungsi dari main.js
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = 'kelulut_backup_' + stamp + '.json';

    const res = await uploadToFolder(folderId, filename, json);
    localStorage.setItem('kelulut_lastBackup', new Date().toISOString());
    alert('✅ Backup berjaya ke Google Drive!');
    updateDriveStatus();
    return { ok: true, result: res };
  } catch (e) {
    console.error(e);
    alert('❌ Gagal backup: ' + e.message);
    return { ok: false, error: e };
  }
}

// ====== RESTORE DATA ======
async function restoreFromDrive() {
  try {
    await initGapi();
    if (!isSignedIn()) {
      alert('⚠️ Sila sambungkan Google Drive dahulu.');
      return;
    }

    const res = await gapi.client.drive.files.list({
      q: "name contains 'kelulut_backup_' and trashed=false",
      fields: 'files(id,name,modifiedTime)',
      orderBy: 'modifiedTime desc',
      pageSize: 5,
    });

    if (!res.result.files.length) {
      alert('❌ Tiada fail backup dijumpai.');
      return;
    }

    const latest = res.result.files[0];
    const file = await gapi.client.drive.files.get({
      fileId: latest.id,
      alt: 'media',
    });

    await importAllData(file.body);
    alert('✅ Data berjaya dipulihkan dari: ' + latest.name);
  } catch (e) {
    console.error(e);
    alert('❌ Gagal restore: ' + e.message);
  }
}

// ====== AUTO BACKUP ======
function scheduleDailyBackupAt(hour, minute) {
  try {
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    const delay = target - now;

    setTimeout(async () => {
      await performBackupNow();
      setInterval(performBackupNow, 24 * 3600 * 1000);
    }, delay);
  } catch (e) {
    console.error('schedule error', e);
  }
}

// ====== WINDOW EXPORT ======
window.signInAndInit = signInAndInit;
window.signOutDrive = signOutDrive;
window.performBackupNow = performBackupNow;
window.restoreFromDrive = restoreFromDrive;
window.scheduleDailyBackupAt = scheduleDailyBackupAt;