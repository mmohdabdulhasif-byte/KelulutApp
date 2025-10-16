
async function refreshCounts(){
  const cols = await getAll('colonies');
  const harv = await getAll('harvests');
  const sales = await getAll('sales');
  document.getElementById('countColonies') && (document.getElementById('countColonies').textContent = cols.length);
  document.getElementById('totalHarvest') && (document.getElementById('totalHarvest').textContent = harv.reduce((a,b)=>a+(Number(b.kg)||0),0));
  document.getElementById('monthlySales') && (document.getElementById('monthlySales').textContent = sales.reduce((a,b)=>a+(Number(b.amount)||0),0));
  document.getElementById('rCountColonies') && (document.getElementById('rCountColonies').textContent = cols.length);
  document.getElementById('rTotalHarvest') && (document.getElementById('rTotalHarvest').textContent = harv.reduce((a,b)=>a+(Number(b.kg)||0),0));
  document.getElementById('rMonthlySales') && (document.getElementById('rMonthlySales').textContent = sales.reduce((a,b)=>a+(Number(b.amount)||0),0));
}

async function populateColonySelectors(){
  const cols = await getAll('colonies');
  document.querySelectorAll('#harvestColony, #careColony').forEach(sel=>{ if(sel) sel.innerHTML = cols.map(c=>`<option value="${c.id}">${c.name}</option>`).join(''); });
}

async function renderAll(){
  await renderColonyTable();
  await renderHarvestTable();
  await renderCareTable();
  await renderSalesTable();
  await renderInvTable();
  await renderInvcTable();
  await refreshCounts();
  await populateColonySelectors();
}

// table renderers
async function renderColonyTable(){ const rows = await getAll('colonies'); const tbody = document.querySelector('#colonyTable tbody'); if(!tbody) return; tbody.innerHTML = rows.map(r=>`<tr><td>${r.name}</td><td>${r.status}</td><td>${r.start||''}</td><td><button onclick="(async()=>{await remove('colonies','${'${r.id}'}'); await renderAll();})()">Hapus</button></td></tr>`).join(''); }
async function renderHarvestTable(){ const rows = await getAll('harvests'); const tbody = document.querySelector('#harvestTable tbody'); if(!tbody) return; tbody.innerHTML = rows.map(r=>`<tr><td>${r.colony}</td><td>${r.kg}</td><td>${r.date||''}</td><td><button onclick="(async()=>{await remove('harvests','${'${r.id}'}'); await renderAll();})()">Hapus</button></td></tr>`).join(''); }
async function renderCareTable(){ const rows = await getAll('careLogs'); const tbody = document.querySelector('#careTable tbody'); if(!tbody) return; tbody.innerHTML = rows.map(r=>`<tr><td>${r.colony}</td><td>${r.title}</td><td>${r.remindAt||''}</td><td><button onclick="(async()=>{await remove('careLogs','${'${r.id}'}'); await renderAll();})()">Hapus</button></td></tr>`).join(''); const due = rows.filter(r=>{ if(!r.remindAt) return false; const t=new Date(r.remindAt); const now=new Date(); return t.toDateString()===now.toDateString(); }).length; document.getElementById('dueCare') && (document.getElementById('dueCare').textContent = due); }
async function renderSalesTable(){ const rows = await getAll('sales'); const tbody = document.querySelector('#salesTable tbody'); if(!tbody) return; tbody.innerHTML = rows.map(r=>`<tr><td>${r.customer}</td><td>${r.qty}</td><td>${r.amount}</td><td>${r.date||''}</td><td><button onclick="(async()=>{await remove('sales','${'${r.id}'}'); await renderAll();})()">Hapus</button></td></tr>`).join(''); }
async function renderInvTable(){ const rows = await getAll('inventory'); const tbody = document.querySelector('#invTable tbody'); if(!tbody) return; tbody.innerHTML = rows.map(r=>`<tr><td>${r.item}</td><td>${r.qty}</td><td><button onclick="(async()=>{await remove('inventory','${'${r.id}'}'); await renderAll();})()">Hapus</button></td></tr>`).join(''); }
async function renderInvcTable(){ const rows = await getAll('invoices'); const tbody = document.querySelector('#invcTable tbody'); if(!tbody) return; tbody.innerHTML = rows.map(r=>`<tr><td>${r.customer}</td><td>${r.total}</td><td>${r.date||''}</td><td><button onclick="(async()=>{await remove('invoices','${'${r.id}'}'); await renderAll();})()">Hapus</button></td></tr>`).join(''); }

// attach form handlers
document.addEventListener('DOMContentLoaded',()=>{
  const fCol = document.getElementById('formColony');
  if(fCol){ fCol.addEventListener('submit', async e=>{ e.preventDefault(); const name=document.getElementById('colonyName').value; const status=document.getElementById('colonyStatus').value; const start=document.getElementById('colonyStart').value; if(!name) return alert('Sila isi nama'); await insert('colonies',{name,status,start}); fCol.reset(); await renderAll(); }); }
  const fHar = document.getElementById('formHarvest');
  if(fHar){ fHar.addEventListener('submit', async e=>{ e.preventDefault(); const colony=document.getElementById('harvestColony').value; const kg=document.getElementById('harvestKg').value; const date=document.getElementById('harvestDate').value; if(!colony||!kg) return alert('Sila lengkapkan'); await insert('harvests',{colony,kg:Number(kg),date}); fHar.reset(); await renderAll(); }); }
  const fCare = document.getElementById('formCare');
  if(fCare){ fCare.addEventListener('submit', async e=>{ e.preventDefault(); const colony=document.getElementById('careColony').value; const title=document.getElementById('careTitle').value; const remind=document.getElementById('careRemind').value; if(!colony||!title) return alert('Sila lengkapkan'); const item={colony,title,remindAt:remind}; await insert('careLogs',item); fCare.reset(); await renderAll(); scheduleSingleIfNear(item); }); }
  const fSale = document.getElementById('formSale');
  if(fSale){ fSale.addEventListener('submit', async e=>{ e.preventDefault(); const customer=document.getElementById('saleCustomer').value; const qty=document.getElementById('saleQty').value; const amount=document.getElementById('saleAmount').value; const date=document.getElementById('saleDate').value; if(!customer||!qty) return alert('Sila lengkapkan'); await insert('sales',{customer,qty:Number(qty),amount:Number(amount),date}); fSale.reset(); await renderAll(); }); }
  const fInv = document.getElementById('formInv');
  if(fInv){ fInv.addEventListener('submit', async e=>{ e.preventDefault(); const item=document.getElementById('invItem').value; const qty=document.getElementById('invQty').value; if(!item) return alert('Sila lengkapkan'); await insert('inventory',{item,qty:Number(qty)}); fInv.reset(); await renderAll(); }); }
  const fInvc = document.getElementById('formInvc');
  if(fInvc){ fInvc.addEventListener('submit', async e=>{ e.preventDefault(); const c=document.getElementById('invcCustomer').value; const tot=document.getElementById('invcTotal').value; const d=document.getElementById('invcDate').value; if(!c||!tot) return alert('Sila lengkapkan'); await insert('invoices',{customer:c,total:Number(tot),date:d}); fInvc.reset(); await renderAll(); }); }

  renderAll();
});
