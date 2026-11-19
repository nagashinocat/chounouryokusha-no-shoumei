import { test, expect } from '@playwright/test';

async function tapCard(page, i = 0) {
  await page.waitForFunction(() => window.__debug?.awaitingPick === true, null, { timeout: 30000 });
  const p = await page.evaluate((i) => window.__debug.cardScreenPos(i), i);
  await page.touchscreen.tap(p.x, p.y);
  await page.waitForFunction(() => window.__debug.awaitingPick === false);
}

test('always miss: game over text then result', async ({ page }) => {
  await page.goto('/index.html?debug=miss');
  await page.locator('[data-title]').click();
  await page.getByRole('button', { name: '始める' }).click();
  for (let i = 0; i < 4; i++) await tapCard(page, i % 4);
  await expect(page.getByText('その後、人口が一人減ったが誰も気づくことはなかった。')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-result]')).toBeVisible({ timeout: 20000 });
  await page.screenshot({ path: 'test-results/result-miss.png' });
  await expect(page.locator('[data-result]')).toContainText('最大連続');
  await page.getByRole('button', { name: /次の挑戦者/ }).click();
  await expect(page.getByText('次の挑戦者は、こいつだ。')).toBeVisible();
});

test('always hit: fate round then clear', async ({ page }) => {
  test.setTimeout(240000);
  await page.goto('/index.html?debug=rig');
  await page.locator('[data-title]').click();
  await page.getByRole('button', { name: '始める' }).click();
  for (let i = 0; i < 15; i++) await tapCard(page, i % 4);
  await expect(page.locator('[data-fate]')).toBeVisible({ timeout: 20000 });
  await page.screenshot({ path: 'test-results/fate.png' });
  await tapCard(page, 1);
  await expect(page.locator('[data-clear]')).toBeVisible({ timeout: 20000 });
  await page.screenshot({ path: 'test-results/clear.png' });
  await expect(page.locator('[data-result]')).toBeVisible({ timeout: 20000 });
});
