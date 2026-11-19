import { rollNumber } from './hud.js';

const fmt = (n) => Math.round(n).toLocaleString('en-US');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

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
    async story(lines, button, { dark = true } = {}) {
      const s = mount(`${lines.map((_, i) => `<p class="line l${i}"></p>`).join('')}<button class="interactive btn" hidden>${esc(button)}</button>`, dark ? 'dark' : '');
      const ps = s.querySelectorAll('p');
      for (let i = 0; i < lines.length; i++) { await typeInto(ps[i], lines[i]); await sleep(350); }
      const b = s.querySelector('button'); b.hidden = false;
      await waitClick(b);
      s.classList.remove('in'); await sleep(350); clear();
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
