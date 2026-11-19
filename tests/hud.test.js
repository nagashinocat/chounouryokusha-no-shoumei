import { it, expect, beforeEach } from 'vitest';
import { rollNumber } from '../src/ui/hud.js';

let frames;
beforeEach(() => {
  frames = [];
  let t = 0;
  globalThis.performance = { now: () => t };
  globalThis.requestAnimationFrame = (fn) => { t += 16; frames.push(fn); };
});
const run = async (p) => { while (frames.length) frames.shift()(globalThis.performance.now()); return p; };
const num = (s) => Number(s.replace(/[^0-9]/g, ''));

it('rolling numbers move smoothly in one direction (no flicker)', async () => {
  for (const [from, to] of [[4, 16], [1024, 768], [17_179_869_184, 12_884_901_888], [8_200_000_000, 8_199_999_999]]) {
    const seen = [];
    const el = { set textContent(v) { seen.push(num(v)); }, get textContent() { return ''; } };
    await run(rollNumber(el, from, to, 500));
    expect(seen.at(-1)).toBe(to);
    for (let i = 1; i < seen.length; i++) {
      if (to >= from) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
      else expect(seen[i]).toBeLessThanOrEqual(seen[i - 1]);
    }
  }
});
