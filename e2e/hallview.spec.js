import { test, expect } from '@playwright/test';

test('title button zooms the camera into the monitor showing recognized psychics, and back', async ({ page }) => {
  await page.goto('/index.html');
  const btn = page.getByRole('button', { name: '認められた超能力者' });
  await expect(btn).toBeVisible();
  await btn.click();
  // カメラがモニターにぐいっと寄る
  await page.waitForFunction(() => window.__debug?.stage?.monitorMode === 'credits', null, { timeout: 10000 });
  await page.waitForTimeout(1500);
  const d = await page.evaluate(() => window.__debug.stage.cameraToMonitor());
  expect(d).toBeLessThan(3.2);
  await page.screenshot({ path: 'test-results/hall-credits.png' });
  // 戻るでタイトルへ。ゲームは始まっていない
  await page.getByRole('button', { name: '戻る' }).click();
  await expect(page.locator('[data-title]')).toBeVisible({ timeout: 10000 });
  await page.waitForFunction(() => window.__debug.stage.monitorMode === 'game', null, { timeout: 10000 });
  await expect(page.getByRole('button', { name: '始める' })).toHaveCount(0);
  // そのままタイトルをタップすれば普通に始まる
  await page.locator('[data-title] .title-text').click();
  await expect(page.getByRole('button', { name: '始める' })).toBeVisible({ timeout: 10000 });
});
