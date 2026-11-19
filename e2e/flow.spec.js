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
  // 全クリした人だけ名前を残せる
  const input = page.locator('[data-nickname] input');
  await expect(input).toBeVisible({ timeout: 20000 });
  await expect(input).toHaveAttribute('maxlength', '12');
  await input.fill('てすとの超能力者');
  await page.screenshot({ path: 'test-results/nickname.png' });
  await page.getByRole('button', { name: '刻む' }).click();
  await expect(page.locator('[data-result]')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('[data-result]')).toContainText('てすとの超能力者');
  // 次の挑戦からは、モニターの下を名前が流れる
  await page.getByRole('button', { name: /次の挑戦者/ }).click();
  await page.getByRole('button', { name: '挑む' }).click();
  await page.waitForFunction(() => window.__debug?.awaitingPick === true, null, { timeout: 30000 });
  expect(await page.evaluate(() => window.__debug.stage.tickerText)).toContain('てすとの超能力者');
  expect(await page.evaluate(() => window.__debug.stage.monitorNoise)).toBe(true);
  // クリア後の次のゲームは、カメラがいつもの位置に戻ってから配られる
  const cam = await page.evaluate(() => { const s = window.__debug.stage; return s.camera.position.distanceTo(s.home.pos); });
  expect(cam).toBeLessThan(0.05);
  await page.screenshot({ path: 'test-results/ticker.png' });
});

test('missing the fate round ends the game', async ({ page }) => {
  test.setTimeout(240000);
  await page.goto('/index.html?debug=fatemiss');
  await page.locator('[data-title]').click();
  await page.getByRole('button', { name: '始める' }).click();
  for (let i = 0; i < 15; i++) await tapCard(page, i % 4);
  await expect(page.locator('[data-fate]')).toBeVisible({ timeout: 20000 });
  await tapCard(page, 2);
  await expect(page.getByText('その後、人口が一人減ったが誰も気づくことはなかった。')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('[data-result]')).toBeVisible({ timeout: 20000 });
});
