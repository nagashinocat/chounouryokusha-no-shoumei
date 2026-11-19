import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('result image is drawn as a 1080x1350 PNG', async ({ page }) => {
  await page.goto('/index.html?test=scene');
  await page.waitForFunction(() => window.__debug?.ready === true);
  const data = await page.evaluate(async () => {
    const { drawResultImage } = await import('/src/share.js');
    const { oddsFor } = await import('/src/odds.js');
    const c = document.createElement('canvas');
    await drawResultImage({ maxStreak: 9, odds: oddsFor(9), cleared: false, vanishedNumber: 12345, believers: 300, rounds: 41, challenger: { label: '挑戦者 No.0042 佐藤 健一(38) 会社員' } }, c);
    return { w: c.width, h: c.height, url: c.toDataURL('image/png') };
  });
  expect([data.w, data.h]).toEqual([1080, 1350]);
  writeFileSync('test-results/result-image.png', Buffer.from(data.url.split(',')[1], 'base64'));
});
