
async function exportReportPDF(elemId='reportContainer'){
  const el = document.getElementById(elemId);
  if(!el) return alert('Report element not found');
  const canvas = await html2canvas(el, { scale: 2 });
  const imgData = canvas.toDataURL('image/png');
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF('p','mm','a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 10;
  const imgProps = pdf.getImageProperties(imgData);
  const imgWidth = pageWidth - margin*2;
  const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
  pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);
  const now = new Date();
  const fname = 'Laporan_Kelulut_' + now.getFullYear() + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0') + '.pdf';
  pdf.save(fname);
}
