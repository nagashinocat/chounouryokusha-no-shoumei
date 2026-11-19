import { SYMBOLS, BASE_POPULATION } from './config.js';
import { createGame, applyGuess, isFateRound } from './rules.js';
import { randomIndex } from './rng.js';
import { makeChallenger, gameOverText } from './challenger.js';
import { oddsFor } from './odds.js';

import { t, DICT } from './i18n.js';

export const OPENING_TEXT = DICT.ja.opening;
export const NEXT_TEXT = DICT.ja.next;

function shuffle(arr, pick) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = pick(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// view は描画側の窓口。rig は 'rig'(必ず当たり)/'miss'(必ず外れ)/null。
// rigFn はテスト用：毎回 'hit' か 'miss' を返す関数
export function createFlow({ counter, storage, view, pick = randomIndex, rig = null, rigFn = null, audio = null, hall = null, power = undefined }) {
  const sfx = (name) => audio?.play(name);
  return {
    async start() {
      const challenger = makeChallenger(storage.nextChallengerNumber(), pick);
      if (power !== undefined) challenger.power = power; // テストや確認用に、能力を決め打ちできる
      const first = storage.isFirstVisit();
      const pop = await counter.fetchPopulation();
      if (first) await view.showOpening(t('opening'), challenger);
      else await view.showChallenger(t('next'), challenger.label, challenger);

      let game = createGame({ population: pop.population });
      await view.hud(game);
      while (game.status === 'playing') {
        const fate = isFateRound(game);
        const symbols = shuffle(SYMBOLS, pick);
        const correct = pick(4);
        const target = symbols[correct];
        if (fate) { sfx('heartbeat'); await view.fateRound(game); }
        // 本物は正解の1枚が、半超能力者は正解を含む2枚が見える
        let hints = [];
        if (challenger.power === 'true') hints = [correct];
        if (challenger.power === 'half') {
          const others = [0, 1, 2, 3].filter((i) => i !== correct);
          const decoy = others[pick(3)];
          hints = pick(2) ? [correct, decoy] : [decoy, correct];
        }
        await view.dealRound(symbols, target, correct, { fate, hints });
        const index = await view.waitPick();
        const hit = rigFn ? rigFn() === 'hit' : rig === 'rig' ? true : rig === 'miss' ? false : rig === 'fatemiss' ? !fate : index === correct;
        const before = game.believers;
        game = applyGuess(game, hit);
        if (hit) { sfx('cheer'); await view.showHit(game, index, { fate }); }
        else { sfx('leave'); await view.showMiss(game, index, correct, before - game.believers, { fate }); }
      }

      storage.saveBest(game.maxStreak);
      const cleared = game.status === 'cleared';
      let vanishedNumber = null;
      let nickname = null;
      if (cleared) {
        sfx('clear');
        await view.showClear(game);
        // 全クリした人だけ、名前を残せる
        if (view.askNickname) {
          nickname = await view.askNickname();
          if (nickname && hall) { const r = await hall.submit(nickname); nickname = r.ok ? r.name : null; }
        }
      } else {
        const r = await counter.reportVanished();
        vanishedNumber = r.vanished;
        sfx('blackout');
        await view.showGameOver(gameOverText(challenger.gender), BASE_POPULATION - (r.vanished - 1), BASE_POPULATION - r.vanished, challenger);
      }
      const result = {
        challenger, cleared, vanishedNumber, nickname,
        maxStreak: game.maxStreak, odds: oddsFor(game.maxStreak),
        believers: game.believers, rounds: game.rounds, best: storage.loadBest(),
      };
      await view.showResult(result);
      return result;
    },
  };
}
