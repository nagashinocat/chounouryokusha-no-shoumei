import { it, expect } from 'vitest';
import { createFlow, OPENING_TEXT, NEXT_TEXT } from '../src/flow.js';
import { createStorage } from '../src/storage.js';
import { createCounter } from '../src/counter.js';
import { gameOverText } from '../src/challenger.js';
import { oddsFor } from '../src/odds.js';

const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

function fakeView() {
  const calls = [];
  const rec = (name) => async (...a) => { calls.push([name, ...a]); };
  return {
    calls, names: () => calls.map(c => c[0]),
    showOpening: rec('showOpening'), showChallenger: rec('showChallenger'), hud: rec('hud'),
    dealRound: rec('dealRound'), waitPick: async () => { calls.push(['waitPick']); return 0; },
    showHit: rec('showHit'), showMiss: rec('showMiss'), fateRound: rec('fateRound'),
    showClear: rec('showClear'), showGameOver: rec('showGameOver'), showResult: rec('showResult'),
  };
}
function setup({ rig, population, backendCount = 0 } = {}) {
  const storage = createStorage(mem());
  let count = backendCount, increments = 0;
  const backend = { getCount: async () => (population != null ? 8_200_000_000 - population : count), increment: async () => { increments++; return ++count; } };
  const counter = createCounter({ backend, storage });
  const view = fakeView();
  const flow = createFlow({ counter, storage, view, rig, pick: (n) => 0 });
  return { flow, view, storage, inc: () => increments };
}

it('first visit shows the opening, later visits introduce the next challenger', async () => {
  const s = setup({ rig: 'miss' });
  await s.flow.start();
  expect(s.view.calls.find(c => c[0] === 'showOpening')[1]).toBe(OPENING_TEXT);
  expect(s.view.names()).not.toContain('showChallenger');
  s.view.calls.length = 0;
  await s.flow.start();
  const intro = s.view.calls.find(c => c[0] === 'showChallenger');
  expect(intro[1]).toBe(NEXT_TEXT);
  expect(intro[2]).toMatch(/^挑戦者 No\.0002 /);
});

it('all misses: 4→3→2→1→0, game over text, one vanish report', async () => {
  const s = setup({ rig: 'miss' });
  const result = await s.flow.start();
  const believers = s.view.calls.filter(c => c[0] === 'showMiss').map(c => c[1].believers);
  expect(believers).toEqual([3, 2, 1, 0]);
  const go = s.view.calls.find(c => c[0] === 'showGameOver');
  expect(go[1]).toBe(gameOverText(result.challenger.gender));
  expect(go[2]).toBe(8_200_000_000); expect(go[3]).toBe(8_199_999_999);
  expect(s.inc()).toBe(1);
  expect(result.vanishedNumber).toBe(1);
});

it('all hits with population 100: third round is the fate round and clears, no vanish', async () => {
  const s = setup({ rig: 'rig', population: 100 });
  const result = await s.flow.start();
  const names = s.view.names();
  const fateAt = names.indexOf('fateRound');
  expect(fateAt).toBeGreaterThan(-1);
  expect(names.filter(n => n === 'showHit').length).toBe(3); // 4→16→64→256
  expect(names.filter(n => n === 'fateRound').length).toBe(1);
  expect(names).toContain('showClear');
  expect(s.inc()).toBe(0);
  expect(result.cleared).toBe(true);
});

it('result carries streak, odds, believers, rounds, challenger and best is saved', async () => {
  const s = setup({ rig: 'rig', population: 100 });
  await s.flow.start();
  const r = s.view.calls.find(c => c[0] === 'showResult')[1];
  expect(r).toMatchObject({ maxStreak: 3, odds: oddsFor(3), believers: 256, rounds: 3, cleared: true, vanishedNumber: null });
  expect(r.challenger.label).toMatch(/^挑戦者 No\.0001 /);
  expect(s.storage.loadBest()).toBe(3);
});

it('target is on the card that carries it', async () => {
  const s = setup({ rig: 'miss' });
  await s.flow.start();
  const deal = s.view.calls.find(c => c[0] === 'dealRound');
  const [, symbols, target, correct] = deal;
  expect(symbols[correct]).toBe(target);
  expect(new Set(symbols).size).toBe(4);
});

it('plays sounds: cheer on hit, leave on miss, heartbeat on fate', async () => {
  const played = [];
  const audio = { play: (n) => played.push(n) };
  const mk = (rig, population) => {
    const storage = createStorage(mem());
    const backend = { getCount: async () => 8_200_000_000 - (population ?? 8_200_000_000), increment: async () => 1 };
    return createFlow({ counter: createCounter({ backend, storage }), storage, view: fakeView(), rig, pick: () => 0, audio });
  };
  await mk('miss').start();
  expect(played.filter(n => n === 'leave').length).toBe(4);
  expect(played).toContain('blackout');
  played.length = 0;
  await mk('rig', 100).start();
  expect(played.filter(n => n === 'cheer').length).toBe(3);
  expect(played).toContain('heartbeat');
  expect(played).toContain('clear');
});

it('missing the fate round is game over (one vanish), not another round', async () => {
  const storage = createStorage(mem());
  let increments = 0, n = 0;
  const backend = { getCount: async () => 8_200_000_000 - 100, increment: async () => ++increments };
  const view = fakeView();
  // 2回当ててから(4→16→64)、運命の選択で外す
  const rig = { next: () => (n++ < 2 ? 'hit' : 'miss') };
  const flow = createFlow({ counter: createCounter({ backend, storage }), storage, view, pick: () => 0, rigFn: () => rig.next() });
  const r = await flow.start();
  const names = view.names();
  expect(names.filter((x) => x === 'fateRound').length).toBe(1);
  expect(names.filter((x) => x === 'dealRound').length).toBe(3);
  expect(names).toContain('showGameOver');
  expect(increments).toBe(1);
  expect(r.cleared).toBe(false);
});

it('after a clear, the player is asked for a nickname before the result; skipping is allowed', async () => {
  for (const answer of ['しょうめい', null]) {
    const storage = createStorage(mem());
    const backend = { getCount: async () => 8_200_000_000 - 100, increment: async () => 1 };
    const view = fakeView();
    view.askNickname = async () => { view.calls.push(['askNickname']); return answer; };
    const submitted = [];
    const hall = { fetchNames: async () => [], submit: async (n) => { submitted.push(n); return { ok: true, name: n }; } };
    const r = await createFlow({ counter: createCounter({ backend, storage }), storage, view, rig: 'rig', pick: () => 0, hall }).start();
    const names = view.names();
    expect(names.indexOf('askNickname')).toBeGreaterThan(names.indexOf('showClear'));
    expect(names.indexOf('askNickname')).toBeLessThan(names.indexOf('showResult'));
    expect(submitted).toEqual(answer ? [answer] : []);
    expect(r.nickname).toBe(answer);
  }
});

it('a game over never asks for a nickname', async () => {
  const storage = createStorage(mem());
  const view = fakeView();
  view.askNickname = async () => { view.calls.push(['askNickname']); return 'x'; };
  const backend = { getCount: async () => 0, increment: async () => 1 };
  await createFlow({ counter: createCounter({ backend, storage }), storage, view, rig: 'miss', pick: () => 0, hall: { fetchNames: async () => [], submit: async () => ({ ok: true }) } }).start();
  expect(view.names()).not.toContain('askNickname');
});

it('a true psychic sees the correct card; a half psychic sees it among two', async () => {
  for (const power of ['true', 'half', null]) {
    const storage = createStorage(mem());
    const view = fakeView();
    const backend = { getCount: async () => 0, increment: async () => 1 };
    let k = 0;
    const pick = (n) => (k++ % n); // 正解の位置がラウンドごとに変わるように
    await createFlow({ counter: createCounter({ backend, storage }), storage, view, rig: 'miss', pick, power }).start();
    const deals = view.calls.filter((c) => c[0] === 'dealRound');
    for (const [, symbols, target, correct, opts] of deals) {
      if (power === 'true') expect(opts.hints).toEqual([correct]);
      if (power === 'half') { expect(opts.hints.length).toBe(2); expect(opts.hints).toContain(correct); expect(new Set(opts.hints).size).toBe(2); }
      if (power === null) expect(opts.hints).toEqual([]);
    }
    const intro = view.calls.find((c) => c[0] === 'showOpening');
    expect(intro[2].power).toBe(power);
    const r = view.calls.find((c) => c[0] === 'showResult')[1];
    expect(r.challenger.power).toBe(power);
  }
});
