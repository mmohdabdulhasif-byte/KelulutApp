/*
Requires SheetJS (XLSX) library:
<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
*/

async function exportStoreXLSX(store) {
  try {
    const rows = await getAll(store);
    if (!rows || rows.length === 0) {
      alert('⚠️ Tiada data untuk dieksport.');
      return;
    }

    // Convert to worksheet
    const ws = XLSX.utils.json_to_sheet(rows);

    // Auto fit column width
    const colWidths = Object.keys(rows[0]).map(k => ({
      wch: Math.max(k.length + 2, ...rows.map(r => String(r[k] || '').length + 2))
    }));
    ws['!cols'] = colWidths;

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, store);

    // File name with timestamp
    const stamp = new Date().toISOString().split('T')[0];
    const filename = `kelulut_${store}_${stamp}.xlsx`;

    // Write to blob
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });

    // Trigger download
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();

    // Feedback
    alert(`✅ Berjaya eksport fail Excel: ${filename}`);
  } catch (e) {
    console.error(e);
    alert('❌ Gagal eksport ke Excel: ' + e.message);
  }
}