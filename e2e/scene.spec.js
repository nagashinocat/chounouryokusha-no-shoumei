import { test, expect } from '@playwright/test';

test('renders the room and picks once per burst of taps', async ({ page }) => {
  await page.goto('/index.html?test=scene');
  await page.waitForFunction(() => window.__debug?.ready === true);
  const shot = await page.screenshot({ path: 'test-results/scene.png' });
  // 中央付近が真っ黒一色ではない
  const lit = await page.evaluate(() => window.__debug.litFraction());
  expect(lit).toBeGreaterThan(0.02);
  for (let i = 0; i < 4; i++) {
    const p = await page.evaluate((i) => window.__debug.cardScreenPos(i), i);
    expect(p.x).toBeGreaterThan(0); expect(p.x).toBeLessThan(390);
  }
  const p = await page.evaluate(() => window.__debug.cardScreenPos(2));
  for (let k = 0; k < 3; k++) { await page.touchscreen.tap(p.x, p.y); await page.waitForTimeout(50); }
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__debug.picks)).toEqual([2]);
});

test('shows a notice when WebGL is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/.test(t) ? null : orig.call(this, t, ...a); };
  });
  await page.goto('/index.html');
  await expect(page.getByText('この端末では遊べません')).toBeVisible();
});
