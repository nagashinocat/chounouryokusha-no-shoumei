import { test, expect } from '@playwright/test';

// 景色が映る画面の上半分(テーブルより上)だけを比べる
const diff = (a, b) => { let d = 0; const end = Math.floor(a.length * 0.45); for (let i = 0; i < end; i += 4) d += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return d / (end / 4); };

test('audience changes with each tier', async ({ page }) => {
  await page.goto('/index.html?test=scene');
  await page.waitForFunction(() => window.__debug?.ready === true);
  const shots = [];
  for (const n of [4, 5000, 500000, 50000000, 5000000000]) {
    await page.evaluate((n) => window.__debug.setBelievers(n), n);
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `test-results/aud-${n}.png` });
    shots.push(await page.evaluate(() => window.__debug.pixels()));
  }
  for (let i = 1; i < shots.length; i++) expect(diff(shots[i - 1], shots[i])).toBeGreaterThan(4);
});
