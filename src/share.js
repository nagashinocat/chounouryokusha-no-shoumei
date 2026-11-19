import { drawSymbol } from './scene/symbols.js';
import { GAME_URL, SYMBOLS } from './config.js';

const fmt = (n) => Math.round(n).toLocaleString('en-US');

export function shareText(r) {
  const head = r.cleared ? '全人類に超能力者だと信じさせた。' : r.vanishedNumber != null ? `${fmt(r.vanishedNumber)}人目の消えた挑戦者になった。` : '';
  return `【超能力者メーカー】最大${r.maxStreak}連続で的中（確率 ${r.odds.percentText}）。${r.odds.analogy}のと同じくらいの確率らしい。${head}`;
}

export function xIntentUrl(text, url) {
  const u = new URL('https://x.com/intent/post');
  u.searchParams.set('text', text); u.searchParams.set('url', url);
  return u.toString();
}

export async function shareResult(blob, result, url = GAME_URL, env = globalThis) {
  const text = shareText(result);
  const nav = env.navigator;
  try {
    const file = new env.File([blob], 'chounouryokusha-maker.png', { type: 'image/png' });
    const data = { files: [file], text, url, title: '超能力者メーカー' };
    if (nav?.canShare?.({ files: [file] }) && nav.share) {
      await nav.share(data);
      return 'shared';
    }
  } catch (e) {
    if (e?.name === 'AbortError') return 'cancelled';
  }
  return 'fallback';
}

export function drawResultImage(r, canvas = document.createElement('canvas')) {
  const W = 1080, H = 1350;
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  const serif = '"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif';
  const sans = '"Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif';
  g.fillStyle = '#050505'; g.fillRect(0, 0, W, H);
  const rg = g.createRadialGradient(W / 2, 520, 50, W / 2, 520, 760);
  rg.addColorStop(0, 'rgba(150,10,25,.55)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg; g.fillRect(0, 0, W, H);
  // 上から差すスポットライト
  const sp = g.createLinearGradient(0, 0, 0, H);
  sp.addColorStop(0, 'rgba(255,240,210,.10)'); sp.addColorStop(1, 'rgba(255,240,210,0)');
  g.fillStyle = sp; g.beginPath(); g.moveTo(W / 2 - 120, 0); g.lineTo(W / 2 + 120, 0); g.lineTo(W / 2 + 460, H); g.lineTo(W / 2 - 460, H); g.fill();

  g.textAlign = 'center'; g.fillStyle = '#ff2b3a';
  g.font = `bold 64px ${serif}`; g.fillText('超 能 力 者 メ ー カ ー', W / 2, 140);
  g.fillStyle = '#aaa'; g.font = `32px ${sans}`; g.fillText(r.challenger.label, W / 2, 215);

  g.fillStyle = '#ccc'; g.font = `40px ${sans}`; g.fillText('最大連続', W / 2, 340);
  g.fillStyle = '#ffd76a'; g.font = `bold 220px ${sans}`; g.fillText(String(r.maxStreak), W / 2, 560);
  g.fillStyle = '#ccc'; g.font = `44px ${sans}`; g.fillText('回 的中', W / 2, 635);

  g.fillStyle = '#fff'; g.font = `bold 70px ${sans}`; g.fillText(r.odds.percentText, W / 2, 765);
  g.fillStyle = '#ccc'; g.font = `34px ${sans}`; g.fillText('これは', W / 2, 845);
  // たとえは長いので折り返す
  g.fillStyle = '#fff'; g.font = `bold 44px ${sans}`;
  const lines = []; let cur = '';
  for (const ch of r.odds.analogy) { if (g.measureText(cur + ch).width > W - 160) { lines.push(cur); cur = ch; } else cur += ch; }
  lines.push(cur);
  lines.forEach((l, i) => g.fillText(l, W / 2, 910 + i * 60));
  let y = 910 + lines.length * 60 + 10;
  g.fillStyle = '#ccc'; g.font = `34px ${sans}`; g.fillText('のと同じくらいの確率です', W / 2, y);

  y += 100;
  g.font = `bold 40px ${serif}`;
  if (r.cleared) { g.fillStyle = '#fff1c4'; g.fillText('全人類が、信じた。', W / 2, y); }
  else if (r.vanishedNumber != null) { g.fillStyle = '#ff4b55'; g.fillText(`${fmt(r.vanishedNumber)}人目の消えた挑戦者`, W / 2, y); }

  SYMBOLS.forEach((s, i) => drawSymbol(g, s, W / 2 + (i - 1.5) * 110, H - 150, 70, 'rgba(255,255,255,.5)', 6));
  g.fillStyle = '#777'; g.font = `28px ${sans}`; g.fillText(GAME_URL.replace(/^https:\/\//, ''), W / 2, H - 60);

  return new Promise((res) => canvas.toBlob((b) => res(b), 'image/png'));
}

// リザルト画面の「共有する」から呼ぶ
export async function shareFromResult(result, fallbackEl) {
  const blob = await drawResultImage(result);
  const outcome = await shareResult(blob, result, GAME_URL, window);
  if (outcome !== 'fallback' || !fallbackEl) return outcome;
  const url = URL.createObjectURL(blob);
  fallbackEl.innerHTML = `<img src="${url}" alt="結果画像" style="width:70%;border:1px solid #333;margin:.6em 0"><br>
    <a href="${url}" download="chounouryokusha-maker.png">画像を保存する</a>
    <a href="${xIntentUrl(shareText(result), GAME_URL)}" target="_blank" rel="noopener">Xに投稿する</a>`;
  fallbackEl.hidden = false;
  return outcome;
}
