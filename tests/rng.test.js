import { it, expect } from 'vitest';
import { randomIndex } from '../src/rng.js';

const fake = (vals) => ({ getRandomValues(a) { a[0] = vals.shift(); return a; } });

it('stays in range and rejects the biased top', () => {
  expect(randomIndex(4, fake([0]))).toBe(0);
  expect(randomIndex(4, fake([7]))).toBe(3);
  expect(randomIndex(3, fake([0xFFFFFFFF, 5]))).toBe(2); // top value rejected, 5%3=2
});
it('is uniform over 400k draws', () => {
  const c = [0, 0, 0, 0];
  for (let i = 0; i < 400000; i++) c[randomIndex(4)]++;
  for (const x of c) expect(Math.abs(x / 400000 - 0.25)).toBeLessThan(0.005);
});
