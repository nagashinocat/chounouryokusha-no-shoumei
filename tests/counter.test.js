import { it, expect, vi } from 'vitest';
import { createCounter } from '../src/counter.js';
import { createStorage } from '../src/storage.js';

const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const ok = (n) => ({ getCount: async () => n, increment: async () => n + 1 });

it('fetches live population and saves last value', async () => {
  const storage = createStorage(mem());
  const c = createCounter({ backend: ok(12), storage });
  expect(await c.fetchPopulation()).toEqual({ population: 8_200_000_000 - 12, vanished: 12, live: true });
  expect(storage.loadLastVanished()).toBe(12);
});
it('falls back to saved value when backend rejects', async () => {
  const storage = createStorage(mem()); storage.saveLastVanished(5);
  const c = createCounter({ backend: { getCount: async () => { throw new Error('x'); }, increment: async () => { throw new Error('x'); } }, storage });
  expect(await c.fetchPopulation()).toEqual({ population: 8_200_000_000 - 5, vanished: 5, live: false });
});
it('falls back after a 3 second timeout', async () => {
  vi.useFakeTimers();
  const storage = createStorage(mem()); storage.saveLastVanished(2);
  const c = createCounter({ backend: { getCount: () => new Promise(() => {}), increment: () => new Promise(() => {}) }, storage });
  const p = c.fetchPopulation();
  await vi.advanceTimersByTimeAsync(3000);
  expect(await p).toMatchObject({ vanished: 2, live: false });
  vi.useRealTimers();
});
it('without backend (unconfigured) it never calls out', async () => {
  const storage = createStorage(mem());
  const c = createCounter({ backend: null, storage });
  expect(await c.fetchPopulation()).toMatchObject({ vanished: 0, live: false });
  expect(await c.reportVanished()).toEqual({ vanished: 1, live: false });
});
it('reportVanished increments live, or bumps local on failure', async () => {
  const storage = createStorage(mem()); storage.saveLastVanished(3);
  expect(await createCounter({ backend: ok(40), storage }).reportVanished()).toEqual({ vanished: 41, live: true });
  expect(storage.loadLastVanished()).toBe(41);
  const bad = { getCount: async () => 0, increment: async () => { throw new Error('denied'); } };
  expect(await createCounter({ backend: bad, storage }).reportVanished()).toEqual({ vanished: 42, live: false });
});
