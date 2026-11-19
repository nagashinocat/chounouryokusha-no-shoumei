import { test, expect } from '@playwright/test';

// iPhone の Safari はツールバーのぶん見える高さが減る(390×664 前後)。どちらでも手前の2枚がしっかり見えること
for (const vp of [{ width: 390, height: 844 }, { width: 390, height: 664 }, { width: 375, height: 560 }]) {
  test(`front cards fully visible at ${vp.width}x${vp.height}`, async ({ page }) => {
    await page.setViewportSize(vp);
    await page.goto('/index.html?test=scene');
    await page.waitForFunction(() => window.__debug?.ready === true);
    const r = await page.evaluate(() => ({ b: Math.max(window.__debug.cards.screenRect(2).bottom, window.__debug.cards.screenRect(3).bottom), h: innerHeight, cssH: document.getElementById('gl').getBoundingClientRect().height }));
    expect(Math.round(r.cssH)).toBe(r.h); // キャンバスが見えている高さと一致
    expect(r.b).toBeLessThan(r.h - 64); // 下のボタンや運命の選択の文字にかからない
    await page.screenshot({ path: `test-results/layout-${vp.height}.png` });
  });
}
