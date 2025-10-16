async function renderChart(){
  const c = document.getElementById('chartCanvas');
  if(!c) return;
  const ctx = c.getContext('2d');
  ctx.clearRect(0,0,c.width,c.height);

  const harv = await getAll('harvests');
  if(!harv.length){
    ctx.fillStyle = '#9aa0a6';
    ctx.font = '16px Inter';
    ctx.fillText('Tiada data hasil untuk dipaparkan.', 20, c.height/2);
    return;
  }

  // Kira jumlah hasil bulanan
  const map = {};
  harv.forEach(h => {
    const d = new Date(h.date);
    const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    map[key] = (map[key] || 0) + (Number(h.kg) || 0);
  });

  const labels = Object.keys(map).slice(-6);
  const data = labels.map(l => map[l]);
  const max = Math.max(...data, 1);
  const w = c.width / (labels.length || 1);

  // Gaya moden
  ctx.font = '12px Inter';
  ctx.textAlign = 'center';
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.fillStyle = '#b8860b';
  ctx.lineWidth = 1;

  // Grid line halus
  for(let i=0;i<=5;i++){
    const y = c.height - 30 - (i/5)*(c.height-60);
    ctx.beginPath();
    ctx.moveTo(30, y);
    ctx.lineTo(c.width-10, y);
    ctx.stroke();
  }

  // Bar
  labels.forEach((lab, i)=>{
    const h = (data[i]/max)*(c.height-60);
    const x = i*w + 40;
    const y = c.height - 30 - h;
    const barWidth = w - 40;

    // Gradient bar
    const grad = ctx.createLinearGradient(0, y, 0, y+h);
    grad.addColorStop(0, '#FFD700');
    grad.addColorStop(1, '#b8860b');
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, h, 6);
    ctx.fill();

    // Label bawah
    ctx.fillStyle = '#e6e7e9';
    ctx.fillText(lab, x + barWidth/2, c.height - 10);
  });

  // Tajuk
  ctx.fillStyle = '#b8860b';
  ctx.font = 'bold 14px Inter';
  ctx.textAlign = 'left';
  ctx.fillText('Graf Hasil Tuai Bulanan (6 Bulan Terkini)', 20, 20);
}