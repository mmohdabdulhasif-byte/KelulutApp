/**
 * main.js - Disesuaikan untuk SPA
 */
(function(window){
  const CLIENT_ID = "253249814475-79vie8d9ovh5evmh6ra69q01ot8g5rd6.apps.googleusercontent.com";
  const SCOPES = "https://www.googleapis.com/auth/drive.file";

  let accessToken = null;
  let tokenClient = null;
  let autoBackupTimer = null;

  // Initialize Google Identity Services
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
              updateDriveStatus(true);
              resolve(accessToken);
            } else {
              reject(new Error("No token"));
            }
          }
        });
        resolve(true);
      } catch (err){
        reject(err);
      }
    });
  }

  // Manual Connect to Google Drive
  async function manualConnect(){
    try {
      if (!tokenClient) await initGIS();
      tokenClient.requestAccessToken();
    } catch (err){
      console.error(err);
      notify("❌ GIS init error: " + err.message, "error");
    }
  }

  // Manual Sign Out
  function manualSignOut(){
    accessToken = null;
    updateDriveStatus(false);
    notify("👋 Log keluar dari Google Drive", "info");
  }

  // Update Drive Status
  function updateDriveStatus(connected){
    const el = document.getElementById("driveStatus");
    if (!el) return;
    el.textContent = connected ? "Drive: Connected ✅" : "Drive: Disconnected ❌";
    el.className = connected ? "status-connected" : "status-disconnected";
  }

  // Notification Helper
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

  // Initialize all forms and tables for SPA
  async function initializePage(pageId) {
    switch(pageId) {
      case 'dashboard':
        await updateDashboard();
        break;
      case 'colonies':
        await initializeColonies();
        break;
      case 'harvests':
        await initializeHarvests();
        break;
      case 'care':
        await initializeCare();
        break;
      case 'sales':
        await initializeSales();
        break;
      case 'inventory':
        await initializeInventory();
        break;
      case 'invoices':
        await initializeInvoices();
        break;
      case 'reports':
        await updateReports();
        break;
    }
  }

  // Dashboard functions
  async function updateDashboard() {
    try {
      const colonies = await db.getAll('colonies');
      const harvests = await db.getAll('harvests');
      const sales = await db.getAll('sales');
      const careLogs = await db.getAll('careLogs');
      
      const totalHarvest = harvests.reduce((sum, h) => sum + (parseFloat(h.kg) || 0), 0);
      const monthlySales = sales
        .filter(s => {
          const saleDate = new Date(s.date);
          const now = new Date();
          return saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear();
        })
        .reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
      
      const today = new Date().toDateString();
      const dueCare = careLogs.filter(c => {
        const careDate = new Date(c.remindAt);
        return careDate.toDateString() === today;
      }).length;

      document.getElementById('countColonies').textContent = colonies.length;
      document.getElementById('totalHarvest').textContent = totalHarvest.toFixed(1);
      document.getElementById('monthlySales').textContent = monthlySales.toFixed(2);
      document.getElementById('dueCare').textContent = dueCare;
    } catch (error) {
      console.error('Error updating dashboard:', error);
    }
  }

  // Colonies Management
  async function initializeColonies() {
    const form = document.getElementById('formColony');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('colonyName').value;
        const status = document.getElementById('colonyStatus').value;
        const start = document.getElementById('colonyStart').value;
        
        if (!name) {
          notify('Sila masukkan nama koloni', 'error');
          return;
        }
        
        try {
          await db.add('colonies', { name, status, start });
          notify('Koloni berjaya ditambah', 'success');
          form.reset();
          renderColoniesTable();
        } catch (error) {
          notify('Gagal menambah koloni: ' + error.message, 'error');
        }
      });
    }
    await renderColoniesTable();
  }

  async function renderColoniesTable() {
    const tbody = document.querySelector('#colonyTable tbody');
    if (!tbody) return;
    
    try {
      const colonies = await db.getAll('colonies');
      tbody.innerHTML = '';
      
      colonies.forEach(colony => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${colony.name}</td>
          <td>${colony.status}</td>
          <td>${colony.start || ''}</td>
          <td>
            <button onclick="deleteColony('${colony.id}')">Padam</button>
          </td>
        `;
        tbody.appendChild(row);
      });
    } catch (error) {
      console.error('Error rendering colonies:', error);
    }
  }

  // Similar functions for other pages (harvests, care, etc.)
  // ... (implement similar patterns for other pages)

  // Export functions to global scope
  window.manualConnect = manualConnect;
  window.manualSignOut = manualSignOut;
  window.updateDashboard = updateDashboard;
  window.initializePage = initializePage;
  window.deleteColony = async (id) => {
    if (confirm('Padam koloni ini?')) {
      try {
        await db.delete('colonies', id);
        notify('Koloni dipadam', 'success');
        renderColoniesTable();
        updateDashboard();
      } catch (error) {
        notify('Gagal memadam koloni', 'error');
      }
    }
  };

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      await db.init();
      await updateDashboard();
      
      // Initialize GIS if Google API is available
      if (window.google) {
        await initGIS();
      }
    } catch (error) {
      console.error('Initialization error:', error);
    }
  });

})(window);