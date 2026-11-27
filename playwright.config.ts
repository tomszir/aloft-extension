import { defineConfig } from '@playwright/test'

export default defineConfig({
  timeout: 20_000,
  // One browser profile per test file; extensions don't share well in parallel.
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  projects: [
    { name: 'chromium', testDir: 'tests/e2e' },
    // Driven by Puppeteer: Playwright can't load extensions into Firefox.
    // The first run downloads Firefox, which takes longer than a test.
    { name: 'firefox', testDir: 'tests/e2e-firefox' },
    // The web demo is an ordinary page, so Playwright drives both browsers.
    { name: 'demo-chromium', testDir: 'tests/e2e-demo', use: { browserName: 'chromium' } },
    { name: 'demo-firefox', testDir: 'tests/e2e-demo', use: { browserName: 'firefox' } },
  ],
})
