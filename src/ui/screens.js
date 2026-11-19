import { rollNumber } from './hud.js';

const fmt = (n) => Math.round(n).toLocaleString('en-US');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// 書き殴った赤い目を1つ、小さなキャンバスに描いておく(スタート画面の背景用)
function eyeSprite(w) {
  const c = document.createElement('canvas'); c.width = w * 2.6; c.height = w * 1.8;
  const g = c.getContext('2d'), cx = c.width / 2, cy = c.height / 2;
  const j = (v, a) => v + (Math.random() - 0.5) * a;
  g.lineCap = 'round'; g.shadowColor = '#ff1a10'; g.shadowBlur = w * 0.25;
  for (let p = 0; p < 6; p++) {
    g.strokeStyle = `rgba(255,${25 + Math.random() * 30},20,${0.5 + Math.random() * 0.5})`;
    g.lineWidth = Math.max(1, w * (0.03 + Math.random() * 0.04));
    g.beginPath();
    for (let i = 0; i <= 36; i++) {
      const a = (i / 36) * Math.PI * 2 + p * 0.4;
      const x = cx + Math.cos(a) * w * j(1, 0.15), y = cy + Math.sin(a) * w * 0.42 * j(1, 0.2);
      i ? g.lineTo(j(x, w * 0.06), j(y, w * 0.06)) : g.moveTo(x, y);
    }
    g.stroke();
  }
  g.strokeStyle = '#ff2a1a';
  for (let i = 0; i < 18; i++) { g.lineWidth = Math.max(1, w * 0.04); g.beginPath(); g.arc(j(cx, w * 0.1), j(cy, w * 0.08), w * (0.06 + Math.random() * 0.22), Math.random() * 6, Math.random() * 6 + 3); g.stroke(); }
  return c;
}

export function createScreens(ui) {
  const layer = document.createElement('div');
  layer.className = 'screens';
  ui.appendChild(layer);

  function mount(html, cls = '') {
    layer.innerHTML = `<div class="screen ${cls}">${html}</div>`;
    const s = layer.firstElementChild;
    requestAnimationFrame(() => s.classList.add('in'));
    return s;
  }
  function clear() { layer.innerHTML = ''; }
  const waitClick = (btn) => new Promise((r) => btn.addEventListener('click', r, { once: true }));

  // 1文字ずつ出す
  async function typeInto(el, text, cps = 22) {
    el.textContent = '';
    for (const ch of text) { el.textContent += ch; await sleep(1000 / cps); }
  }

  return {
    clear,
    // スタート画面：黒地の真ん中に縦書きで題字、後ろで信者の目がぼんやり光る。どこかをタップで進む
    title(text = '超能力者の証明', { onHall = null, onHallBack = null } = {}) {
      const s = mount(`<canvas></canvas><div class="title-text">${esc(text)}</div>
        ${onHall ? '<button class="btn hall-btn">認められた超能力者</button><button class="btn hall-back">戻る</button>' : ''}
        <p class="title-hint">画面をタップ</p>`, 'title-screen interactive');
      let inHall = false;
      if (onHall) {
        s.querySelector('.hall-btn').addEventListener('click', async (e) => {
          e.stopPropagation(); if (inHall) return; inHall = true;
          s.classList.add('hall');           // タイトルを消して、奥の3Dの部屋を見せる
          await onHall();
        });
        s.querySelector('.hall-back').addEventListener('click', async (e) => {
          e.stopPropagation();
          s.classList.add('leaving');
          await onHallBack?.();
          s.classList.remove('hall', 'leaving'); inHall = false;
        });
      }
      s.dataset.title = '';
      const cv = s.querySelector('canvas'), g = cv.getContext('2d');
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      let eyes = [], alive = true;
      const layout = () => {
        cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
        const n = Math.round(10 + (innerWidth * innerHeight) / 40000);
        eyes = Array.from({ length: n }, () => {
          // 題字の真後ろ(中央の帯)は避けて散らす
          let x; do { x = Math.random(); } while (Math.abs(x - 0.5) < 0.2);
          const w = (14 + Math.random() * 30) * dpr;
          return { x: x * cv.width, y: Math.random() * cv.height, img: eyeSprite(w), ph: Math.random() * 6.3, sp: 0.4 + Math.random() * 0.6, blink: 0, next: 1 + Math.random() * 6 };
        });
      };
      layout(); addEventListener('resize', layout);
      let last = performance.now();
      const draw = (now) => {
        if (!alive) return;
        const dt = Math.min(0.1, (now - last) / 1000); last = now;
        g.clearRect(0, 0, cv.width, cv.height);
        g.filter = `blur(${1.6 * dpr}px)`; // ぼんやり
        for (const e of eyes) {
          e.next -= dt; if (e.next <= 0) { e.blink = 0.22; e.next = 3 + Math.random() * 7; }
          e.blink = Math.max(0, e.blink - dt);
          const open = e.blink > 0 ? Math.abs(Math.cos((e.blink / 0.22) * Math.PI)) : 1;
          g.globalAlpha = 0.18 + 0.22 * (0.5 + 0.5 * Math.sin(now / 1000 * e.sp + e.ph));
          const w = e.img.width, h = e.img.height * Math.max(0.06, open);
          g.drawImage(e.img, e.x - w / 2, e.y - h / 2, w, h);
        }
        g.globalAlpha = 1; g.filter = 'none';
        requestAnimationFrame(draw);
      };
      requestAnimationFrame(draw);
      return new Promise((resolve) => {
        s.addEventListener('click', async () => {
          if (inHall) return;
          s.classList.remove('in'); await sleep(500);
          alive = false; removeEventListener('resize', layout); clear(); resolve();
        }, { once: true });
      });
    },
    async story(lines, button, { dark = true } = {}) {
      const s = mount(`${lines.map((_, i) => `<p class="line l${i}"></p>`).join('')}<button class="interactive btn" hidden>${esc(button)}</button>`, dark ? 'dark' : '');
      const ps = s.querySelectorAll('p');
      for (let i = 0; i < lines.length; i++) { await typeInto(ps[i], lines[i]); await sleep(350); }
      const b = s.querySelector('button'); b.hidden = false;
      await waitClick(b);
      s.classList.remove('in'); await sleep(350); clear();
    },
    // 全クリした人だけ：名前を残す(残さないことも選べる)。名前か null を返す
    async nickname(max = 12) {
      const s = mount(`<div class="nick interactive" data-nickname>
          <p class="line">あなたの名を、証明として残せ。</p>
          <p class="nick-sub">モニターに、認められた超能力者として流れ続けます(${max}文字まで)</p>
          <input type="text" maxlength="${max}" autocomplete="off" enterkeyhint="done" placeholder="ニックネーム">
          <p class="nick-err" hidden>その名前は刻めません。別の名前にしてください。</p>
          <div class="btns"><button class="btn carve">刻む</button><button class="btn skip">残さない</button></div>
        </div>`, 'dark');
      const input = s.querySelector('input');
      setTimeout(() => input.focus(), 400);
      const answer = await new Promise((resolve) => {
        const carve = () => { const v = input.value.trim(); if (v) resolve(v); else s.querySelector('.nick-err').hidden = false; };
        s.querySelector('.carve').addEventListener('click', carve);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') carve(); });
        s.querySelector('.skip').addEventListener('click', () => resolve(null));
      });
      s.classList.remove('in'); await sleep(350); clear();
      return answer;
    },
    banner(text, attrs = '', cls = '') {
      const s = mount(`<div class="banner ${cls}" ${attrs}>${esc(text)}</div>`, 'pass');
      return { el: s.firstElementChild, remove: () => { s.classList.remove('in'); setTimeout(() => { if (s.parentNode) clear(); }, 400); } };
    },
    async gameOver(text, before, after) {
      const s = mount(`<p class="line go-text"></p><p class="pop" hidden>世界人口<br><b>${fmt(before)}</b>人</p>`, 'black');
      await sleep(900);
      await typeInto(s.querySelector('.go-text'), text, 14);
      await sleep(1200);
      const pop = s.querySelector('.pop'); pop.hidden = false;
      await sleep(900);
      const b = pop.querySelector('b'); b.classList.add('tick');
      await rollNumber(b, before, after, 500);
      await sleep(1600);
      s.classList.remove('in'); await sleep(400); clear();
    },
    async result(r, { onShare } = {}) {
      const s = mount(`
        <div class="result interactive" data-result>
          <h2>${r.cleared ? '全人類が、信じた。' : '記 録'}</h2>
          <p class="who">${esc(r.challenger.label)}</p>
          <dl>
            <dt>最大連続</dt><dd><b class="r-streak">0</b>回</dd>
            <dt>その確率</dt><dd class="r-odds"><b>${esc(r.odds.percentText)}</b></dd>
          </dl>
          <p class="analogy" hidden>これは<br><b>${esc(r.odds.analogy)}</b><br>のと同じくらいの確率です</p>
          <dl class="small">
            <dt>最終の信者</dt><dd><span class="r-bel">0</span>人</dd>
            <dt>めくった回数</dt><dd>${r.rounds}回</dd>
            ${r.vanishedNumber != null ? `<dt>消えた挑戦者</dt><dd>${fmt(r.vanishedNumber)}人目</dd>` : ''}
            ${r.nickname ? `<dt>認められた超能力者</dt><dd>${esc(r.nickname)}</dd>` : ''}
            <dt>自己ベスト</dt><dd>${r.best}連続</dd>
          </dl>
          <div class="btns">
            <button class="btn share">結果を共有する</button>
            <button class="btn retry">次の挑戦者へ</button>
          </div>
          <div class="share-fallback" hidden></div>
        </div>`, 'result-screen');
      // 演出中に押されても取りこぼさないよう、先に待ち受ける
      const retry = waitClick(s.querySelector('.retry'));
      s.querySelector('.share').addEventListener('click', () => onShare?.(s.querySelector('.share-fallback')));
      await sleep(300);
      await rollNumber(s.querySelector('.r-streak'), 1, Math.max(r.maxStreak, 0), 700);
      s.querySelector('.r-streak').textContent = r.maxStreak;
      s.querySelector('.analogy').hidden = false;
      await rollNumber(s.querySelector('.r-bel'), 1, r.believers, 600);
      await retry;
      s.classList.remove('in'); await sleep(350); clear();
    },
  };
}
