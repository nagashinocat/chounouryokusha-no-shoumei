import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'e2e',
  timeout: 120000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    locale: 'ja-JP', // 既定は日本語の端末。英語は e2e/i18n.spec.js で確かめる
    launchOptions: { executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  webServer: { command: 'npx http-server -p 4173 -c-1 -s .', url: 'http://127.0.0.1:4173/index.html', reuseExistingServer: true },
});
