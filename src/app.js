import { createStorage } from './storage.js';
import { createCounter, firebaseBackend } from './counter.js';
import { createFlow } from './flow.js';
import { createHud } from './ui/hud.js';
import { createScreens } from './ui/screens.js';
import { createFx } from './scene/fx.js';
import { debugMode } from './debug.js';

export async function startGame({ stage, cards, audience, ui, params, audio = null, share = null }) {
  const storage = createStorage();
  const counter = createCounter({ backend: firebaseBackend(), storage });
  const hud = createHud(ui);
  const screens = createScreens(ui);
  const fx = createFx(stage, cards, audience);
  const dbg = (window.__debug ??= {});
  dbg.awaitingPick = false;
  const rig = debugMode(params, location.hostname);

  let fateBanner = null;
  const view = {
    async showOpening(text) {
      hud.show(false);
      await screens.story([text], '始める');
      audio?.unlock(); audio?.bgm(true);
    },
    async showChallenger(text, label) {
      hud.show(false);
      await screens.story([text, label], '挑む');
      audio?.unlock(); audio?.bgm(true);
    },
    async hud(game) {
      await audience.setBelievers(game.believers, { animate: false });
      hud.setPopulation(game.population); hud.set(game); hud.show(true);
    },
    async dealRound(symbols, target, correct, { fate }) {
      stage.setMonitorSymbol(target);
      audio?.play('flip');
      await cards.deal(symbols);
      cards.unlock();
      dbg.awaitingPick = true;
    },
    waitPick() {
      return new Promise((resolve) => {
        const off = cards.onPick((i) => { off(); dbg.awaitingPick = false; resolve(i); });
      });
    },
    async fateRound() {
      cards.hideAll();
      fateBanner = screens.banner('運 命 の 選 択', 'data-fate', 'fate');
      await fx.fateIntro();
      fateBanner.el.classList.add('small');
    },
    async showHit(game, index, { fate }) {
      if (!fate) await cards.focus(index);
      await cards.reveal(index, true, null, fate ? 1.4 : 0.4);
      if (fate) { fateBanner?.remove(); fateBanner = null; }
      await Promise.all([audience.cheer(), hud.count(game)]);
      if (fate) return; // クリア演出へ
      await Promise.all([cards.unfocus(), audience.setBelievers(game.believers)]);
    },
    async showMiss(game, index, correct, left, { fate }) {
      if (!fate) await cards.focus(index);
      await cards.reveal(index, false, correct, fate ? 1.4 : 0.4);
      hud.flashRed();
      if (fate) { fateBanner?.remove(); fateBanner = null; await fx.fateEnd(); }
      const before = game.believers + left;
      await Promise.all([audience.leave(before ? left / before : 1), hud.count(game)]);
      await Promise.all([cards.unfocus(), audience.setBelievers(Math.max(game.believers, 1))]);
    },
    async showClear() {
      hud.show(false);
      const b = screens.banner('全人類が、あなたを超能力者だと信じた。', 'data-clear', 'clear');
      await fx.clear();
      await new Promise((r) => setTimeout(r, 2200));
      b.remove();
    },
    async showGameOver(text, before, after) {
      hud.show(false);
      await screens.gameOver(text, before, after);
    },
    async showResult(result) {
      // 画像は先に作っておき、タップの中で同期的に共有シートを開く(iOS 対策)
      const handler = share?.(result);
      await screens.result(result, { onShare: (fallbackEl) => handler?.share(fallbackEl) });
      await fx.resetAfterClear();
      cards.lock();
    },
  };

  const flow = createFlow({ counter, storage, view, rig, audio });
  for (;;) await flow.start();
}
