import { test, expect } from '@playwright/test';

test('title shows the remaining world population (and in English after switching)', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cm.vanished', '5'));
  await page.goto('/index.html');
  const pop = page.locator('[data-title] .title-pop');
  await expect(pop).toContainText('世界人口');
  await expect(pop).toContainText('8,199,999,995');
  await page.screenshot({ path: 'test-results/title-pop.png' });
  await page.getByRole('button', { name: 'EN' }).click();
  await expect(pop).toContainText('World population');
  await expect(pop).toContainText('8,199,999,995');
});
