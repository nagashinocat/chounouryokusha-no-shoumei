import { createStage } from './scene/stage.js';
import { createCards } from './scene/cards.js';
import { createAudience } from './scene/audience.js';
import { SYMBOLS } from './config.js';

const params = new URLSearchParams(location.search);
const ui = document.getElementById('ui');

function notice(text) {
  ui.innerHTML = `<div class="notice">${text}</div>`;
}

function litFractionOf(canvas) {
  const c = document.createElement('canvas'); c.width = 80; c.height = 160;
  const g = c.getContext('2d'); g.drawImage(canvas, 0, 0, 80, 160);
  const d = g.getImageData(0, 0, 80, 160).data; let lit = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 90) lit++;
  return lit / (80 * 160);
}

function pixelsOf(canvas) {
  const c = document.createElement('canvas'); c.width = 60; c.height = 130;
  const g = c.getContext('2d'); g.drawImage(canvas, 0, 0, 60, 130);
  return Array.from(g.getImageData(0, 0, 60, 130).data);
}

async function boot() {
  const testMode = params.get('test');
  const stage = createStage(document.getElementById('gl'), { preserve: !!testMode });
  if (!stage) { notice('この端末では遊べません。<br>3D表示(WebGL)に対応したブラウザで開いてください。'); return; }
  const cards = createCards(stage);
  const audience = createAudience(stage);
  audience.setBelievers(4, { animate: false });
  window.__debug = { stage, cards, audience,
    setBelievers: (n) => audience.setBelievers(n), pixels: () => pixelsOf(stage.renderer.domElement), litFraction: () => litFractionOf(stage.renderer.domElement), cardScreenPos: (i) => cards.screenPos(i) };
  if (testMode === 'scene') {
    window.__debug.picks = [];
    cards.onPick((i) => window.__debug.picks.push(i));
    stage.setMonitorSymbol('star');
    await cards.deal(SYMBOLS);
    cards.unlock();
    await stage.wait(0.2);
    window.__debug.ready = true;
    return;
  }
  const [{ startGame }, { shareFromResult }, { createAudio, mountMuteButton }, { createStorage }] = await Promise.all([
    import('./app.js'), import('./share.js'), import('./audio.js'), import('./storage.js')]);
  const audio = createAudio(createStorage());
  mountMuteButton(ui, audio);
  startGame({ stage, cards, audience, ui, params, audio, share: shareFromResult });
}
boot();
