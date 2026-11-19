import { it, expect, vi } from 'vitest';
import { shareResult, shareText, xIntentUrl } from '../src/share.js';
import { oddsFor } from '../src/odds.js';

const result = { maxStreak: 10, odds: oddsFor(10), cleared: false, vanishedNumber: 12345, believers: 500, rounds: 30, challenger: { label: '挑戦者 No.0001 佐藤 健一(38) 会社員' } };
const blob = { type: 'image/png' };
const URL_ = 'https://nagashinocat.github.io/chounouryokusha-maker/';

it('uses Web Share with the image when files can be shared', async () => {
  const share = vi.fn(async () => {});
  const env = { navigator: { canShare: () => true, share }, File: class { constructor(p, n, o) { this.name = n; this.type = o.type; } }, open: vi.fn() };
  expect(await shareResult(blob, result, URL_, env)).toBe('shared');
  const arg = share.mock.calls[0][0];
  expect(arg.files[0].name).toBe('chounouryokusha-maker.png');
  expect(arg.text).toContain('10連続');
});

it('falls back when files cannot be shared', async () => {
  const env = { navigator: { canShare: () => false }, open: vi.fn() };
  expect(await shareResult(blob, result, URL_, env)).toBe('fallback');
  const env2 = { navigator: {}, open: vi.fn() };
  expect(await shareResult(blob, result, URL_, env2)).toBe('fallback');
});

it('share text includes streak and odds; X url is encoded', () => {
  const t = shareText(result);
  expect(t).toContain('10連続');
  expect(t).toContain('1/1,048,576');
  const u = new URL(xIntentUrl(t, URL_));
  expect(u.origin + u.pathname).toBe('https://x.com/intent/post');
  expect(u.searchParams.get('text')).toBe(t);
  expect(u.searchParams.get('url')).toBe(URL_);
});

it('a cancelled share is not a failure', async () => {
  const err = Object.assign(new Error('x'), { name: 'AbortError' });
  const env = { navigator: { canShare: () => true, share: async () => { throw err; } }, File: class { constructor(p, n, o) { this.name = n; } }, open: vi.fn() };
  expect(await shareResult(blob, result, URL_, env)).toBe('cancelled');
});

it('prepared share calls navigator.share synchronously inside the tap (iOS)', async () => {
  const { prepareShare } = await import('../src/share.js');
  let calledSync = false;
  const env = { navigator: { canShare: () => true, share: () => { calledSync = true; return Promise.resolve(); } }, File: class { constructor(p, n, o) { this.name = n; } }, open() {} };
  const h = prepareShare(result, async () => blob, env);
  await h.ready;
  const p = h.share(null);
  expect(calledSync).toBe(true); // await より前に呼ばれている
  expect(await p).toBe('shared');
});
