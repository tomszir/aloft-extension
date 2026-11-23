import solid from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'
import { WxtVitest } from 'wxt/testing/vitest-plugin'

export default defineConfig({
  // WxtVitest doesn't apply WXT modules' Vite plugins, so Solid's JSX
  // transform is added here.
  plugins: [WxtVitest(), solid()],
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    restoreMocks: true,
  },
})
