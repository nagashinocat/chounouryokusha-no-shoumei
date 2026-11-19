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

it('bgm is a music box: plinked notes from the melody, looping', async () => {
  const { AC, started } = fakeAC();
  globalThis.window = { AudioContext: AC };
  const { createAudio, MUSIC_BOX_MELODY, noteFreq } = await import('../src/audio.js');
  const a = createAudio(null);
  a.bgm(true);
  a._tick(40); // 40秒ぶん先まで並べる
  // 音程はわざと少し揺らしているので ±1.5% で照合する
  const melodyFreqs = MUSIC_BOX_MELODY.filter((n) => n[0] != null).map(([n]) => noteFreq(n));
  const fund = started.filter((s) => melodyFreqs.some((f) => Math.abs(s.f / f - 1) < 0.015));
  expect(fund.length).toBeGreaterThan(MUSIC_BOX_MELODY.length); // 1周以上鳴っている
  expect(new Set(fund.map((s) => s.t)).size).toBe(fund.length); // 同じ時刻に旋律の音を二重に鳴らさない
  delete globalThis.window;
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
