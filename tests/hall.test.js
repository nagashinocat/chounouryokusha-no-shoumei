import { it, expect } from 'vitest';
import { sanitizeNickname, tickerText, createHall } from '../src/hall.js';
import { createStorage } from '../src/storage.js';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

it('sanitizes nicknames: trims, collapses spaces, 12 chars max, no URLs or markup', () => {
  expect(sanitizeNickname('  エセ  超能力者  ')).toBe('エセ 超能力者');
  expect(sanitizeNickname('あいうえおかきくけこさしすせそ')).toBe('あいうえおかきくけこさし');
  expect(sanitizeNickname('')).toBe(null);
  expect(sanitizeNickname('   ')).toBe(null);
  expect(sanitizeNickname('http://spam.example')).toBe(null);
  expect(sanitizeNickname('www.spam')).toBe(null);
  expect(sanitizeNickname('spam.com')).toBe(null);
  expect(sanitizeNickname('<b>x</b>')).toBe('bxb');
  expect(sanitizeNickname('a\u0000b\nc')).toBe('a b c');
});

it('ticker text lists the proven ones, or says nobody yet', () => {
  expect(tickerText([])).toBe('まだ誰もいない');
  expect(tickerText(['たろう', 'はなこ'])).toBe('認められた超能力者　たろう　／　はなこ');
});

it('hall falls back to local names when offline and remembers your own entry', async () => {
  const storage = createStorage(mem());
  const hall = createHall({ backend: null, storage });
  expect(await hall.fetchNames()).toEqual([]);
  expect(await hall.submit('  ななし ')).toEqual({ ok: true, name: 'ななし', live: false });
  expect(await hall.fetchNames()).toEqual(['ななし']);
  expect(await hall.submit('http://x')).toEqual({ ok: false, reason: 'invalid' });
});

it('hall uses the backend when available, newest first', async () => {
  const storage = createStorage(mem());
  const sent = [];
  const backend = { listClearers: async () => ['b', 'a'], addClearer: async (n) => { sent.push(n); } };
  const hall = createHall({ backend, storage });
  expect(await hall.fetchNames()).toEqual(['b', 'a']);
  expect(await hall.submit('c')).toEqual({ ok: true, name: 'c', live: true });
  expect(sent).toEqual(['c']);
});
