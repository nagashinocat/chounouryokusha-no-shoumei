import { test, expect } from '@playwright/test';

test('start page: vertical white title on black with faint glowing eyes, tap to begin', async ({ page }) => {
  await page.goto('/index.html?debug=miss');
  const title = page.locator('[data-title] .title-text');
  await expect(title).toHaveText('超能力者の証明');
  await expect(title).toBeVisible();
  const style = await title.evaluate((el) => { const s = getComputedStyle(el); return { wm: s.writingMode, color: s.color }; });
  expect(style.wm).toBe('vertical-rl');
  expect(style.color).toBe('rgb(255, 255, 255)');
  const bg = await page.locator('[data-title]').evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).toBe('rgb(0, 0, 0)');
  // 後ろで目がぼんやり光っている(赤い画素がある)
  await page.waitForTimeout(1500);
  const red = await page.locator('[data-title] canvas').evaluate((c) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 60 && d[i] > d[i + 1] * 2) n++;
    return n;
  });
  expect(red).toBeGreaterThan(200);
  await page.screenshot({ path: 'test-results/title.png' });
  await page.locator('[data-title]').click();
  await expect(page.getByRole('button', { name: '始める' })).toBeVisible({ timeout: 10000 });
});
