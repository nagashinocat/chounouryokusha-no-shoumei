import { it, expect } from 'vitest';
import { oddsFor, ANALOGIES } from '../src/odds.js';

it('denominator is 4^n with a non-empty analogy', () => {
  for (let n = 0; n <= 17; n++) {
    const o = oddsFor(n);
    expect(o.denominator).toBe(4 ** n);
    expect(o.analogy.length).toBeGreaterThan(0);
    expect(o.percentText.length).toBeGreaterThan(0);
  }
  expect(oddsFor(10).denominator).toBe(1048576);
});
it('picks the nearest analogy on a log scale', () => {
  for (let n = 1; n <= 17; n++) {
    const d = 4 ** n, chosen = oddsFor(n).analogy;
    const best = ANALOGIES.reduce((b, a) => Math.abs(Math.log(d / a.denominator)) < Math.abs(Math.log(d / b.denominator)) ? a : b);
    expect(chosen).toBe(best.text);
  }
});
it('analogies are sorted, 15+ and cover 1/4..1/2e10', () => {
  expect(ANALOGIES.length).toBeGreaterThanOrEqual(15);
  for (let i = 1; i < ANALOGIES.length; i++) expect(ANALOGIES[i].denominator).toBeGreaterThan(ANALOGIES[i - 1].denominator);
  expect(ANALOGIES[0].denominator).toBeLessThanOrEqual(4);
  expect(ANALOGIES.at(-1).denominator).toBeGreaterThanOrEqual(1e10);
});
