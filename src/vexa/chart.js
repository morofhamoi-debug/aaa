export function drawCandles(canvas, rows) {
  if (!canvas || !Array.isArray(rows) || rows.length === 0) return;
  const width = Math.max(280, Math.floor(canvas.clientWidth || 600));
  const height = 260;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.height = height + 'px';
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  const css = getComputedStyle(document.documentElement);
  const grid = css.getPropertyValue('--line-strong').trim() || 'rgba(130,130,150,.2)';
  const text = css.getPropertyValue('--muted').trim() || '#888';
  const green = css.getPropertyValue('--success').trim() || '#58bb92';
  const red = css.getPropertyValue('--danger').trim() || '#df7183';
  const padding = { left: 18, right: 12, top: 16, bottom: 31 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const values = rows.flatMap((row) => [Number(row.low_price), Number(row.high_price)]).filter(Number.isFinite);
  if (!values.length) return;
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max === min) { max += 1; min -= 1; }
  const pad = (max - min) * .08;
  min -= pad; max += pad;
  const y = (price) => padding.top + ((max - price) / (max - min)) * plotHeight;
  const xStep = plotWidth / rows.length;
  const bodyWidth = Math.max(2, Math.min(13, xStep * .56));

  ctx.clearRect(0, 0, width, height);
  ctx.font = '10px DM Sans, sans-serif';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const gy = padding.top + (plotHeight / 4) * i;
    const label = max - ((max - min) / 4) * i;
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, gy);
    ctx.lineTo(width - padding.right, gy);
    ctx.stroke();
    ctx.fillStyle = text;
    ctx.textAlign = 'left';
    ctx.fillText(new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(label), padding.left + 5, gy - 7);
  }

  const maxVolume = Math.max(1, ...rows.map((row) => Number(row.volume || 0)));
  rows.forEach((row, index) => {
    const open = Number(row.open_price);
    const close = Number(row.close_price);
    const high = Number(row.high_price);
    const low = Number(row.low_price);
    if (![open, close, high, low].every(Number.isFinite)) return;
    const center = padding.left + xStep * (index + .5);
    const color = close >= open ? green : red;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, Math.min(2, xStep * .14));
    ctx.beginPath();
    ctx.moveTo(center, y(high));
    ctx.lineTo(center, y(low));
    ctx.stroke();
    const top = y(Math.max(open, close));
    const bottom = y(Math.min(open, close));
    const bodyHeight = Math.max(2, bottom - top);
    ctx.fillStyle = color;
    ctx.fillRect(center - bodyWidth / 2, top, bodyWidth, bodyHeight);

    const volumeHeight = Math.max(1, (Number(row.volume || 0) / maxVolume) * 18);
    ctx.globalAlpha = .35;
    ctx.fillRect(center - bodyWidth / 2, height - 23 - volumeHeight, bodyWidth, volumeHeight);
    ctx.globalAlpha = 1;
  });

  ctx.fillStyle = text;
  ctx.textAlign = 'left';
  const firstDate = new Date(rows[0].bucket);
  const lastDate = new Date(rows.at(-1).bucket);
  const formatTime = (date) => Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
  }).format(date);
  ctx.fillText(formatTime(firstDate), padding.left, height - 10);
  ctx.textAlign = 'right';
  ctx.fillText(formatTime(lastDate), width - padding.right, height - 10);
}
