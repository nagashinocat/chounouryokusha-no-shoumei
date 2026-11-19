import { test, expect } from '@playwright/test';

// スマホと同じ「ユーザー操作がないと音を出せない」設定で確かめる
test.use({ launchOptions: { executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=user-gesture-required'] } });

test('a touch tap on 始める starts the audio and the music box', async ({ page }) => {
  await page.goto('/index.html?debug=miss');
  const t = await page.locator('[data-title]').boundingBox();
  await page.touchscreen.tap(t.x + t.width / 2, t.y + t.height / 2);
  const btn = page.getByRole('button', { name: '始める' });
  await btn.waitFor();
  const box = await btn.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() => window.__debug?.awaitingPick === true, null, { timeout: 30000 });
  expect(await page.evaluate(() => window.__debug.audio.state)).toBe('running');
  expect(await page.evaluate(() => window.__debug.audio.bgmPlaying)).toBe(true);
});
