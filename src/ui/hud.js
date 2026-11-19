import { MAX_MISSES } from '../config.js';
import { t } from '../i18n.js';

const fmt = (n) => Math.round(n).toLocaleString('en-US');

export function rollNumber(el, from, to, duration = 600, suffix = '') {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / duration);
      // 桁がトゥルルと回るように、対数で補間しつつ下の桁を揺らす
      const a = Math.log(Math.max(from, 1)), b = Math.log(Math.max(to, 1));
      const e = 1 - Math.pow(1 - k, 3);
      // 桁が大きく違うときは対数で、近いときはそのまま補間する(どちらも一方向に動くだけ)
      const v = Math.abs(b - a) > 1 ? Math.exp(a + (b - a) * e) : from + (to - from) * e;
      el.textContent = fmt(k >= 1 ? to : v) + suffix;
      if (k < 1) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
}

export function createHud(ui) {
  const el = document.createElement('div');
  el.className = 'hud';
  el.innerHTML = `
    <div class="hud-row"><span class="hud-label"></span><span class="hud-believers">4</span><span class="hud-unit"></span>
      <span class="hud-streak" hidden>🔥<b>0</b><i class="hud-streak-unit"></i></span></div>
    <div class="hud-bar"><i></i></div>
    <div class="hud-sub"><span class="hud-lives"></span><span class="hud-pop"><em class="hud-pop-label"></em> <span>8,200,000,000</span><em class="hud-pop-unit"></em></span></div>`;
  ui.appendChild(el);
  const red = document.createElement('div'); red.className = 'redflash'; ui.appendChild(red);
  const $ = (s) => el.querySelector(s);
  let shown = 4, population = 8_200_000_000;
  // 言語に合わせて見出しを書く(ゲームを始めるたびに呼ぶ)
  const relabel = () => {
    $('.hud-label').textContent = t('believers'); $('.hud-unit').textContent = t('people');
    $('.hud-streak-unit').textContent = t('streak'); $('.hud-pop-label').textContent = t('popLabel'); $('.hud-pop-unit').textContent = t('people');
  };
  relabel();

  function bar(n) {
    const k = Math.min(1, Math.log(Math.max(n, 1)) / Math.log(population));
    $('.hud-bar i').style.width = `${(k * 100).toFixed(1)}%`;
  }
  return {
    el,
    show(v = true) { if (v) relabel(); el.classList.toggle('on', v); },
    setPopulation(p) { population = p; $('.hud-pop span').textContent = fmt(p); bar(shown); },
    set(game) {
      shown = game.believers; $('.hud-believers').textContent = fmt(game.believers); bar(game.believers);
      this.streak(game.streak); this.lives(game.misses);
    },
    async count(game) {
      const from = shown; shown = game.believers; bar(game.believers);
      this.streak(game.streak); this.lives(game.misses);
      el.classList.toggle('up', game.believers > from); el.classList.toggle('down', game.believers < from);
      await rollNumber($('.hud-believers'), from, game.believers, 550);
      el.classList.remove('up', 'down');
    },
    lives(misses) {
      const left = MAX_MISSES - misses;
      $('.hud-lives').innerHTML = `<i>${'●'.repeat(left)}</i><i class="lost">${'●'.repeat(misses)}</i>`;
      $('.hud-lives').setAttribute('aria-label', t('livesAria', { n: left }));
    },
    streak(s) { const st = $('.hud-streak'); st.hidden = s < 2; st.querySelector('b').textContent = s; },
    flashRed() { red.classList.remove('go'); void red.offsetWidth; red.classList.add('go'); },
  };
}
