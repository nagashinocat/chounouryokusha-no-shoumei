import { it, expect } from 'vitest';
import { tierFor } from '../src/tiers.js';
it('maps believers to tiers', () => {
  expect([100, 101, 10000, 10001, 1e6, 1e6 + 1, 1e8, 1e8 + 1].map(tierFor))
    .toEqual(['room', 'theater', 'theater', 'stadium', 'stadium', 'city', 'city', 'earth']);
});
