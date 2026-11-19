// ESPカード風の4図柄を2Dキャンバスに描く。
export function drawSymbol(ctx, symbol, cx, cy, size, color = '#111', width = size * 0.09) {
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const r = size / 2;
  ctx.beginPath();
  if (symbol === 'circle') ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
  else if (symbol === 'plus') { ctx.moveTo(cx - r * 0.85, cy); ctx.lineTo(cx + r * 0.85, cy); ctx.moveTo(cx, cy - r * 0.85); ctx.lineTo(cx, cy + r * 0.85); }
  else if (symbol === 'wave') {
    for (const dy of [-0.45, 0, 0.45]) {
      for (let i = 0; i <= 40; i++) {
        const x = cx - r * 0.85 + (i / 40) * r * 1.7, y = cy + dy * r + Math.sin((i / 40) * Math.PI * 3) * r * 0.16;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
    }
  } else if (symbol === 'star') {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.36 : r * 0.88;
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
  }
  ctx.stroke();
  ctx.restore();
}
