import solid from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'
import { WxtVitest } from 'wxt/testing/vitest-plugin'

// Each test runs once per build target. WxtVitest exposes the target as the
// strings "true"/"false", which would make every `if (import.meta.env.FIREFOX)`
// pass, so it's defined here as the boolean the builds see.
const target = (name: 'chromium' | 'firefox') => ({
  extends: true,
  test: { name },
  define: {
    'import.meta.env.FIREFOX': JSON.stringify(name === 'firefox'),
    'import.meta.env.CHROME': JSON.stringify(name === 'chromium'),
  },
})

export default defineConfig({
  // WxtVitest doesn't apply WXT modules' Vite plugins, so Solid's JSX
  // transform is added here.
  plugins: [WxtVitest(), solid()],
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    restoreMocks: true,
    projects: [target('chromium'), target('firefox')],
  },
})
