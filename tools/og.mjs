import { chromium } from '@playwright/test';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.goto('http://127.0.0.1:4173/tools/og.html'); await p.waitForFunction(() => window.done);
await p.waitForTimeout(300);
await p.screenshot({ path: 'og.png' }); await b.close();
