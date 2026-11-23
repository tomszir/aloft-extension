import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 20_000,
  // One browser profile per test file; extensions don't share well in parallel.
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
})
