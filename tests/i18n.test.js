import { it, expect, afterEach } from 'vitest';
import { detectLang, setLang, getLang, t, DICT } from '../src/i18n.js';
import { createStorage } from '../src/storage.js';
import { makeChallenger, gameOverText } from '../src/challenger.js';
import { oddsFor, ANALOGIES, ANALOGIES_EN } from '../src/odds.js';
import { tickerText, creditPages } from '../src/hall.js';
import { shareText } from '../src/share.js';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
afterEach(() => setLang('ja'));

it('picks Japanese for Japanese phones, English otherwise; a saved choice wins', () => {
  expect(detectLang(['ja-JP', 'en'], createStorage(mem()))).toBe('ja');
  expect(detectLang(['en-US'], createStorage(mem()))).toBe('en');
  expect(detectLang(['fr-FR', 'de'], createStorage(mem()))).toBe('en');
  expect(detectLang([], createStorage(mem()))).toBe('ja');
  const s = createStorage(mem()); s.set('cm.lang', 'ja');
  expect(detectLang(['en-US'], s)).toBe('ja');
});

it('every Japanese key has an English text and vice versa', () => {
  expect(Object.keys(DICT.en).sort()).toEqual(Object.keys(DICT.ja).sort());
  const unitKeys = ['people', 'timesUnit', 'analogyPost']; // 英語では単位を付けない
  for (const [k, v] of Object.entries(DICT.en)) if (!unitKeys.includes(k)) expect(v, k).toBeTruthy();
});

it('English texts', () => {
  setLang('en');
  expect(getLang()).toBe('en');
  expect(t('title')).toBe('Proof of a Psychic');
  expect(t('start')).toBe('Start');
  expect(t('gameOver')).toBe('Afterward, the population dropped by one. No one ever noticed.');
  expect(gameOverText('m')).toBe(t('gameOver'));
  expect(t('ticker', { names: 'A / B' })).toBe('RECOGNIZED PSYCHICS　A / B');
  expect(tickerText([])).toBe('No one yet');
  expect(creditPages([])).toEqual([['No one yet']]);
});

it('challenger label in English', () => {
  setLang('en');
  const c = makeChallenger(7, () => 0);
  expect(c.label).toMatch(/^Challenger No\.0007 \S+ \S+ \(18\), .+$/);
});

it('odds analogies have an English twin for every entry', () => {
  expect(ANALOGIES_EN.map((a) => a.denominator)).toEqual(ANALOGIES.map((a) => a.denominator));
  setLang('en');
  expect(oddsFor(10).analogy).toBe(ANALOGIES_EN.find((a) => a.denominator === 1048576).text);
  expect(oddsFor(0).analogy).toBe('nothing happening at all');
});

it('share text in English', () => {
  setLang('en');
  const r = { maxStreak: 10, odds: oddsFor(10), cleared: false, vanishedNumber: 3, challenger: { label: 'x' } };
  const s = shareText(r);
  expect(s.startsWith('[Proof of a Psychic]')).toBe(true);
  expect(s).toContain('10 in a row');
  expect(s).toContain('1/1,048,576');
});
