import { test, expect } from '@playwright/test';

for (const [power, line, count] of [['true', 'この挑戦者は、本物かもしれない。', 1], ['half', 'この挑戦者には、少しだけ見えている。', 2]]) {
  test(`a ${power} psychic is announced and sees ${count} glowing card(s)`, async ({ page }) => {
    await page.goto(`/index.html?debug=miss&power=${power}`);
    await page.locator('[data-title] .title-text').click();
    await expect(page.getByText(line)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: '始める' }).click();
    await page.waitForFunction(() => window.__debug?.awaitingPick === true, null, { timeout: 30000 });
    const hinted = await page.evaluate(() => window.__debug.cards.hinted());
    expect(hinted.length).toBe(count);
    await page.screenshot({ path: `test-results/power-${power}.png` });
    // 外し続けてリザルトへ。本物/半分だったことが書かれる
    for (let i = 0; i < 4; i++) {
      await page.waitForFunction(() => window.__debug.awaitingPick === true, null, { timeout: 30000 });
      const p = await page.evaluate(() => window.__debug.cardScreenPos(0));
      await page.touchscreen.tap(p.x, p.y);
      await page.waitForFunction(() => window.__debug.awaitingPick === false);
    }
    await expect(page.locator('[data-result]')).toContainText(power === 'true' ? '本物の超能力者だった' : '半超能力者だった', { timeout: 30000 });
  });
}

test('the power param is ignored outside localhost-style debug (no power by default)', async ({ page }) => {
  await page.goto('/index.html?debug=miss');
  await page.locator('[data-title] .title-text').click();
  await page.getByRole('button', { name: '始める' }).click();
  await page.waitForFunction(() => window.__debug?.awaitingPick === true, null, { timeout: 30000 });
  expect(await page.evaluate(() => window.__debug.cards.hinted())).toEqual([]);
});
