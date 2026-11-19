import { it, expect, beforeEach } from 'vitest';
import { createStorage } from '../src/storage.js';

const mem = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)) }; };
const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };

for (const [name, mk] of [['localStorage', mem], ['broken storage', () => broken]]) {
  it(`works with ${name}`, () => {
    const s = createStorage(mk());
    expect(s.loadBest()).toBe(0);
    s.saveBest(5); s.saveBest(3);
    expect(s.loadBest()).toBe(5);
    expect(s.nextChallengerNumber()).toBe(1);
    expect(s.isFirstVisit()).toBe(true);
    expect(s.nextChallengerNumber()).toBe(2);
    expect(s.isFirstVisit()).toBe(false);
    s.saveLastVanished(12);
    expect(s.loadLastVanished()).toBe(12);
  });
}
it('persists across instances', () => {
  const ls = mem();
  createStorage(ls).saveBest(9);
  expect(createStorage(ls).loadBest()).toBe(9);
});
