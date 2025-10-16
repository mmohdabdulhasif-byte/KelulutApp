<script>
const driveAuth = (() => {
  const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
  const TOKEN_CLIENT = { client: null };
  let accessToken = null;

  async function init(clientId) {
    return new Promise((resolve, reject) => {
      gapi.load('client', async () => {
        try {
          await gapi.client.load('https://www.googleapis.com/discovery/v1/apis/drive/v3/rest');
          TOKEN_CLIENT.client = google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: SCOPES,
            callback: (tokenResponse) => {
              accessToken = tokenResponse.access_token;
              logDebug("✅ Token diterima dari GIS.");
              resolve();
            }
          });
          logDebug("✅ GIS siap dimuat.");
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  async function signIn() {
    return new Promise((resolve, reject) => {
      if (!TOKEN_CLIENT.client) return reject(new Error("GIS belum inisialisasi"));
      TOKEN_CLIENT.client.requestAccessToken();
      // GIS callback akan urus token
      const check = setInterval(() => {
        if (accessToken) {
          clearInterval(check);
          resolve(accessToken);
        }
      }, 500);
      setTimeout(() => reject(new Error("Timeout semasa sign-in")), 10000);
    });
  }

  function isConnected() {
    return !!accessToken;
  }

  async function uploadFile(filename, blob) {
    if (!accessToken) throw new Error('Not signed in');
    const metadata = { name: filename, parents: ['appDataFolder'] };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob, filename);
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + accessToken },
      body: form
    });
    return await res.json();
  }

  async function listFiles() {
    if (!accessToken) throw new Error('Not signed in');
    const res = await fetch('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&pageSize=20', {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    });
    const data = await res.json();
    return data.files || [];
  }

  async function downloadFile(id) {
    if (!accessToken) throw new Error('Not signed in');
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    });
    return await res.blob();
  }

  function signOut() {
    accessToken = null;
    logDebug("🚪 Telah log keluar (token dipadam).");
  }

  return { init, signIn, isConnected, uploadFile, listFiles, downloadFile, signOut };
})();
</script>

<!-- Tambah di HEAD bawah api.js -->
<script src="https://accounts.google.com/gsi/client" async defer></script>