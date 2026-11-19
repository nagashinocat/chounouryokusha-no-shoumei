import { it, expect } from 'vitest';
import { createAudio } from '../src/audio.js';
it('unlock resumes an interrupted (iOS) or suspended context', () => {
  let resumed = 0;
  class AC { constructor() { this.state = 'interrupted'; this.currentTime = 0; this.destination = {}; } createGain() { return { gain: { value: 0 }, connect() {} }; } resume() { resumed++; this.state = 'running'; return Promise.resolve(); } }
  globalThis.window = { AudioContext: AC };
  const a = createAudio(null);
  a.unlock();
  expect(resumed).toBe(1);
  a.unlock();
  expect(resumed).toBe(1);
  delete globalThis.window;
});

function fakeAC() {
  const started = [];
  class Param { constructor(v = 0) { this.value = v; } setValueAtTime() {} exponentialRampToValueAtTime() {} linearRampToValueAtTime() {} setTargetAtTime() {} }
  const node = () => ({ connect(n) { return n ?? this; }, gain: new Param(1), frequency: new Param(), Q: new Param(), detune: new Param(), type: '' });
  class AC {
    constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; this.sampleRate = 8000; }
    createGain() { return node(); } createBiquadFilter() { return node(); } createDelay() { return { ...node(), delayTime: new Param() }; }
    createConvolver() { return { ...node(), buffer: null }; }
    createBuffer(c, len) { return { getChannelData: () => new Float32Array(len) }; }
    createBufferSource() { return { ...node(), start() {}, stop() {} }; }
    createOscillator() { const o = { ...node(), start: (t) => started.push({ f: o.frequency.value, t }), stop() {} }; return o; }
    resume() { return Promise.resolve(); }
  }
  return { AC, started };
}

it('the score loops 8 bars of the voice-memo melody in music-box register', async () => {
  const { MELODY, LOOP_STEPS } = await import('../src/audio.js');
  expect(LOOP_STEPS).toBe(64); // 8小節 × 8分音符8つ
  for (const [step, midi, len] of MELODY) {
    expect(step).toBeGreaterThanOrEqual(0); expect(step).toBeLessThan(64);
    expect(midi).toBeGreaterThanOrEqual(72); expect(midi).toBeLessThanOrEqual(91);
    expect(len).toBeGreaterThan(0);
  }
  // 2つ目のボイスメモ：頭はF#、終わりは主音Eで落ち着く(2オクターブ上げたもの)
  expect(MELODY[0]).toEqual([0, 54 + 24, 2]);
  expect(MELODY.at(-1)).toEqual([62, 52 + 24, 2]);
  expect(MELODY.length).toBe(49);
});

it('melody stays in E minor (plus the leading tone D#) so it is eerie but not queasy', async () => {
  const { MELODY } = await import('../src/audio.js');
  const allowed = new Set([4, 6, 7, 9, 11, 0, 2, 3]); // E F# G A B C D D#
  for (const [, m] of MELODY) expect(allowed.has(m % 12)).toBe(true);
});

it('backing follows E-minor chords: bass, pad and choir only use chord tones', async () => {
  const { eventsAt, CHORDS } = await import('../src/audio.js');
  expect(CHORDS.length).toBe(8);
  const diatonic = { E: 4, A: 9, B: 11, C: 0, D: 2, G: 7 };
  for (const c of CHORDS) expect(Object.values(diatonic)).toContain(c.root % 12);
  for (let st = 0; st < 64; st++) {
    const chord = CHORDS[Math.floor(st / 8)];
    for (const e of eventsAt(st, 4)) {
      if (['bass', 'pad', 'choir'].includes(e.inst)) {
        for (const m of e.notes) expect(chord.tones).toContain(((m % 12) + 12) % 12);
      }
    }
  }
});

it('layers add instruments; the first added is a kick going "dan, da-dan"', async () => {
  const { eventsAt } = await import('../src/audio.js');
  const insts = (layers) => new Set(Array.from({ length: 64 }, (_, i) => eventsAt(i, layers)).flat().map((e) => e.inst));
  expect([...insts(0)]).toEqual(['box']);
  expect([...insts(1)].sort()).toEqual(['box', 'kick']);
  expect(insts(2).size).toBe(3); expect(insts(3).size).toBe(4); expect(insts(4).size).toBe(5);
  const kicks = Array.from({ length: 8 }, (_, i) => eventsAt(i, 1).some((e) => e.inst === 'kick'));
  expect(kicks).toEqual([true, false, false, false, true, true, false, false]); // ダン、 ダダん
});

it('tiers map to layers', async () => {
  const { layersForTier } = await import('../src/audio.js');
  expect(['room', 'theater', 'stadium', 'city', 'earth'].map(layersForTier)).toEqual([0, 1, 2, 3, 4]);
});

it('unlocks on touchend and click (iOS needs a finished tap), playing a silent buffer', async () => {
  const { AC } = fakeAC();
  let silentStarts = 0;
  class AC2 extends AC { constructor() { super(); this.state = 'suspended'; } createBufferSource() { const s = super.createBufferSource(); s.start = () => { silentStarts++; }; return s; } }
  globalThis.window = { AudioContext: AC2 };
  const nav = {};
  globalThis.navigator ??= {};
  const { createAudio, installUnlock } = await import('../src/audio.js');
  const a = createAudio(null, nav);
  const handlers = {};
  installUnlock({ addEventListener: (type, fn) => { handlers[type] = fn; } }, a);
  expect(Object.keys(handlers)).toEqual(expect.arrayContaining(['touchend', 'click', 'pointerdown', 'keydown']));
  handlers.touchend();
  expect(silentStarts).toBe(1);
  expect(nav.audioSession).toBeUndefined();
  const nav2 = { audioSession: { type: 'auto' } };
  createAudio(null, nav2).unlock();
  expect(nav2.audioSession.type).toBe('playback'); // iOS のマナーモードでも鳴らす
  delete globalThis.window;
});
