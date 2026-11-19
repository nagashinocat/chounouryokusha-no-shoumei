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

it('the score is the solfege the owner wrote, 3 notes per group, played twice over 8 bars', async () => {
  const { MELODY, LOOP_STEPS } = await import('../src/audio.js');
  expect(LOOP_STEPS).toBe(64);
  // シ ミ レ♯ シ レ ド♯ ラ ド シ ソ ラ シ ラ ソ ミ ミ ファ♯ ソ ファ♯ ミ レ♯ ド♯ レ♯ ミ (2オクターブ上げたもの)
  const solfege = [59, 64, 63, 59, 62, 61, 57, 60, 59, 55, 57, 59, 57, 55, 52, 52, 54, 55, 54, 52, 51, 49, 51, 52].map((m) => m + 24);
  expect(MELODY.map(([, m]) => m)).toEqual([...solfege, ...solfege]);
  // リズム：まとまりごとに 8分・8分・4分
  MELODY.forEach(([st, , len], i) => {
    expect(st).toBe(Math.floor(i / 3) * 4 + (i % 3));
    expect(len).toBe(i % 3 === 2 ? 2 : 1);
  });
  for (const [, m] of MELODY) { expect(m).toBeGreaterThanOrEqual(72); expect(m).toBeLessThanOrEqual(91); }
});

it('backing follows chords in the melody key: bass, pad and choir only use chord tones', async () => {
  const { eventsAt, CHORDS } = await import('../src/audio.js');
  expect(CHORDS.length).toBe(8);
  // ホ短調まわりの和音(E, A, B, C, D, G を根音とするもの)
  for (const c of CHORDS) expect([4, 9, 11, 0, 2, 7]).toContain(c.root % 12);
  for (let st = 0; st < 64; st++) {
    const chord = CHORDS[Math.floor(st / 8)];
    for (const e of eventsAt(st, 4)) {
      if (['bass', 'pad', 'choir'].includes(e.inst)) {
        for (const m of e.notes) expect(chord.tones).toContain(((m % 12) + 12) % 12);
      }
    }
  }
});

it('each bar picks a chord with the fewest semitone clashes against the melody', async () => {
  const { MELODY, CHORDS, CHORD_CANDIDATES } = await import('../src/audio.js');
  const clashLen = (c, bar) => MELODY.filter(([st]) => st >= bar * 8 && st < bar * 8 + 8)
    .filter(([, m]) => c.tones.some((t) => [1, 11].includes(((m - t) % 12 + 12) % 12)))
    .reduce((a, [, , len]) => a + len, 0);
  CHORDS.forEach((c, bar) => {
    const least = Math.min(...CHORD_CANDIDATES.map((k) => clashLen(k, bar)));
    expect(`${bar}:${clashLen(c, bar)}`).toBe(`${bar}:${least}`);
  });
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

it('when iOS interrupts the audio, it resumes by itself (no tap needed)', async () => {
  let resumed = 0, ctxRef;
  class AC { constructor() { ctxRef = this; this.state = 'running'; this.currentTime = 0; this.destination = {}; this.onstatechange = null; }
    createGain() { return { gain: { value: 0 }, connect() {} }; } createBuffer() { return {}; } createBufferSource() { return { connect() {}, start() {} }; }
    resume() { resumed++; this.state = 'running'; return Promise.resolve(); } }
  globalThis.window = { AudioContext: AC, setTimeout: (f) => f() };
  globalThis.document = { visibilityState: 'visible', addEventListener() {}, createElement: () => ({ play: () => Promise.resolve(), setAttribute() {}, style: {} }) };
  const { createAudio } = await import('../src/audio.js');
  const a = createAudio(null, {});
  a.unlock();
  const before = resumed;
  ctxRef.state = 'interrupted'; ctxRef.onstatechange?.();
  expect(resumed).toBe(before + 1);
  delete globalThis.window; delete globalThis.document;
});

it('no hidden <audio> element is used (it would let iOS keep playing in the background)', async () => {
  const made = [];
  class AC { constructor() { this.state = 'suspended'; this.currentTime = 0; this.destination = {}; }
    createGain() { return { gain: { value: 0 }, connect() {} }; } createBuffer() { return {}; } createBufferSource() { return { connect() {}, start() {} }; }
    resume() { this.state = 'running'; return Promise.resolve(); } }
  globalThis.window = { AudioContext: AC, addEventListener() {} };
  globalThis.document = { visibilityState: 'visible', addEventListener() {}, createElement: (tag) => { made.push(tag); return { play: () => Promise.resolve(), setAttribute() {}, style: {} }; } };
  const { createAudio } = await import('../src/audio.js');
  createAudio(null, {}).unlock();
  expect(made).not.toContain('audio');
  delete globalThis.window; delete globalThis.document;
});

it('switching away (hidden, pagehide or blur) silences at once and suspends; coming back resumes', async () => {
  let ctxRef; const calls = []; const docH = {}, winH = {};
  class AC { constructor() { ctxRef = this; this.state = 'running'; this.currentTime = 0; this.destination = {}; }
    createGain() { const g = { gain: { value: 0, setTargetAtTime(v) { g.gain.value = v; } }, connect() {} }; return g; } createBuffer() { return {}; } createBufferSource() { return { connect() {}, start() {} }; }
    suspend() { calls.push('suspend'); this.state = 'suspended'; return Promise.resolve(); }
    resume() { calls.push('resume'); this.state = 'running'; return Promise.resolve(); } }
  globalThis.window = { AudioContext: AC, addEventListener: (t, f) => { winH[t] = f; } };
  globalThis.document = { visibilityState: 'visible', hasFocus: () => true, addEventListener: (t, f) => { docH[t] = f; }, createElement: () => ({}) };
  const { createAudio } = await import('../src/audio.js');
  const a = createAudio(null, {});
  a.unlock();
  for (const hide of [() => { document.visibilityState = 'hidden'; docH.visibilitychange(); }, () => winH.pagehide(), () => winH.blur()]) {
    calls.length = 0;
    hide();
    expect(calls).toContain('suspend');
    expect(a._masterGain()).toBe(0);
    calls.length = 0;
    document.visibilityState = 'visible'; (docH.visibilitychange)(); winH.focus?.(); winH.pageshow?.();
    expect(calls).toContain('resume');
    expect(a._masterGain()).toBeGreaterThan(0);
  }
  delete globalThis.window; delete globalThis.document;
});
