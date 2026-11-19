import { test, expect } from '@playwright/test';

test.describe('English phone', () => {
  test.use({ locale: 'en-US' });
  test('starts in English, horizontal title; the switch goes to Japanese and is remembered', async ({ page }) => {
    await page.goto('/index.html?debug=miss');
    const title = page.locator('[data-title] .title-text');
    await expect(title).toHaveText('Proof of a Psychic');
    expect(await title.evaluate((el) => getComputedStyle(el).writingMode)).toBe('horizontal-tb');
    await expect(page.getByRole('button', { name: 'Recognized Psychics' })).toBeVisible();
    await page.screenshot({ path: 'test-results/en-title.png' });
    // 英語のまま遊ぶ
    await page.locator('[data-title] .title-text').click();
    await page.getByRole('button', { name: 'Start' }).click();
    await page.waitForFunction(() => window.__debug?.awaitingPick === true, null, { timeout: 30000 });
    await expect(page.locator('.hud')).toContainText('Believers');
    expect(await page.evaluate(() => window.__debug.stage.findThisText)).toBe('F I N D   T H I S');
    await page.screenshot({ path: 'test-results/en-play.png' });
  });
  test('language button switches to Japanese and the choice survives a reload', async ({ page }) => {
    await page.goto('/index.html');
    await page.getByRole('button', { name: 'JP' }).click();
    await expect(page.locator('[data-title] .title-text')).toHaveText('超能力者の証明');
    await page.reload();
    await expect(page.locator('[data-title] .title-text')).toHaveText('超能力者の証明');
    await expect(page.getByRole('button', { name: 'EN' })).toBeVisible();
  });
});

test.describe('Japanese phone', () => {
  test.use({ locale: 'ja-JP' });
  test('starts in Japanese with the vertical title', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.locator('[data-title] .title-text')).toHaveText('超能力者の証明');
    expect(await page.locator('[data-title] .title-text').evaluate((el) => getComputedStyle(el).writingMode)).toBe('vertical-rl');
  });
});
