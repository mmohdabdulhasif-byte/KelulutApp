// sales_custom.js - local sales, attachment upload, simple invoice generator
(function(){
  const FORM_ID = 'formSale';
  const KEY = 'kelulut_sales_v1';

  function uid(){ return 'S'+Date.now(); }
  function load(){ return JSON.parse(localStorage.getItem(KEY)||'[]'); }
  function save(arr){ localStorage.setItem(KEY, JSON.stringify(arr)); }
  function formatDate(d){ if(!d) return ''; const dt=new Date(d); return dt.toLocaleDateString(); }

  function renderTable(){
    const tbody = document.querySelector('#salesTable tbody') || (()=>{ const t=document.getElementById('salesTable'); const b=document.createElement('tbody'); t.appendChild(b); return b; })();
    tbody.innerHTML='';
    const arr = load();
    arr.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.customer||''}</td><td>${s.qty||''}</td><td>${s.amount||''}</td><td>${formatDate(s.date)}</td>
        <td>
          <button data-id="${s.id}" class="btn-invoice">Invois</button>
          <button data-id="${s.id}" class="btn-resit">Resit</button>
          <button data-id="${s.id}" class="btn-delete">Padam</button>
        </td>`;
      tbody.appendChild(tr);
    });
  }

  function readFileAsArrayBuffer(file){ return new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=e=>res(e.target.result); fr.onerror=rej; fr.readAsArrayBuffer(file); }); }

  document.addEventListener('submit', async function(e){
    if(e.target && e.target.id === FORM_ID){
      e.preventDefault();
      const id = uid();
      const customer = (document.getElementById('saleCustomer')||{}).value || '';
      const qty = (document.getElementById('saleQty')||{}).value || '';
      const amount = (document.getElementById('saleAmount')||{}).value || '';
      const date = (document.getElementById('saleDate')||{}).value || new Date().toISOString();
      const input = document.getElementById('saleReceipt');
      if(input && input.files && input.files[0]){
        try{
          const f = input.files[0];
          const ab = await readFileAsArrayBuffer(f);
          await AttachDB.saveAttachment(id, f.name, f.type, ab);
        }catch(err){
          console.error('save attachment', err);
        }
      }
      const arr = load();
      arr.push({ id, customer, qty, amount, date });
      save(arr);
      e.target.reset();
      renderTable();
    }
  });

  document.addEventListener('click', async function(e){
    const target = e.target;
    if(target.classList.contains('btn-resit')){
      const id = target.getAttribute('data-id');
      const rec = await AttachDB.getAttachment(id);
      if(!rec){ alert('Tiada resit untuk rekod ini.'); return; }
      const blob = new Blob([rec.data], { type: rec.mime });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } else if(target.classList.contains('btn-delete')){
      const id = target.getAttribute('data-id');
      if(!confirm('Padam rekod ini?')) return;
      let arr = load(); arr = arr.filter(x=>x.id!==id); save(arr);
      try{ await AttachDB.deleteAttachment(id); }catch(e){}
      renderTable();
    } else if(target.classList.contains('btn-invoice')){
      const id = target.getAttribute('data-id');
      const arr = load(); const s = arr.find(x=>x.id===id);
      if(!s){ alert('Rekod tidak ditemui'); return; }
      const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invois ${s.id}</title>
      <style>body{font-family:Arial;padding:16px} .h{display:flex;justify-content:space-between} table{width:100%;border-collapse:collapse} td,th{border:1px solid #ddd;padding:8px}</style></head><body>
      <div class="h"><div><h2>[Nama Ladang Anda]</h2><div>Alamat ladang</div></div><div><strong>Invois:</strong> ${s.id}<br><strong>Tarikh:</strong> ${formatDate(s.date)}</div></div><hr>
      <h3>Pelanggan</h3><div>${s.customer}</div>
      <h3>Butiran</h3>
      <table><tr><th>Item</th><th>Kuantiti</th><th>Jumlah (RM)</th></tr>
      <tr><td>Madu Kelulut</td><td>${s.qty}</td><td>${s.amount}</td></tr></table>
      <h3>Jumlah: RM ${s.amount}</h3><p>Terima kasih.</p></body></html>`;
      const w = window.open('', '_blank'); w.document.write(html); w.document.close();
      setTimeout(()=>{ try{ w.print(); }catch(e){} },500);
    }
  });

  // initial render on load
  document.addEventListener('DOMContentLoaded', renderTable);
})();

// generateInvoicePDF - uses jsPDF to create a PDF invoice and trigger download
async function generateInvoicePDF(s){
  try{
    // fetch logo if set
    let logoData = localStorage.getItem('kelulut_logo_data') || null;
    const { jsPDF } = window.jspdf || window.jspdf || {};
    const doc = new jsPDF();
    let y = 10;
    if(logoData){
      try{ doc.addImage(logoData, 'PNG', 10, y, 50, 20); }catch(e){}
    }
    doc.setFontSize(14);
    doc.text('[Nama Ladang Anda]', 70, 20);
    doc.setFontSize(10);
    doc.text('Alamat Ladang', 70, 26);
    y += 30;
    doc.setFontSize(12);
    doc.text('Invois: ' + s.id, 10, y); doc.text('Tarikh: ' + (new Date(s.date)).toLocaleDateString(), 140, y);
    y += 10;
    doc.setFontSize(11);
    doc.text('Pelanggan: ' + (s.customer || '-'), 10, y);
    y += 10;
    if(doc.autoTable){
      doc.autoTable({ startY: y+2, head: [['Item','Kuantiti','Jumlah (RM)']], body: [['Madu Kelulut', s.qty || '', s.amount || '']] });
    }else{
      doc.text('Item: Madu Kelulut   Kuantiti: '+(s.qty||'')+'   Jumlah: '+(s.amount||''), 10, y+10);
    }
    const fname = 'INVOICE_' + s.id + '.pdf';
    doc.save(fname);
  }catch(e){ console.error('PDF gen error', e); alert('Gagal jana PDF invois.'); }
}
