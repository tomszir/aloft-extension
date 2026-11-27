import solid from 'vite-plugin-solid'
import { configDefaults, defineConfig } from 'vitest/config'
import { WxtVitest } from 'wxt/testing/vitest-plugin'
import { demoMessages, demoSwaps } from './scripts/demo-plugins.ts'
import { demoAliases } from './vite.demo.config.ts'

// Each test runs once per build target. WxtVitest exposes the target as the
// strings "true"/"false", which would make every `if (import.meta.env.FIREFOX)`
// pass, so it's defined here as the boolean the builds see.
// WxtVitest doesn't apply WXT modules' Vite plugins, so Solid's JSX
// transform is added here.
const target = (name: 'chromium' | 'firefox') => ({
  plugins: [WxtVitest(), solid()],
  test: {
    name,
    environment: 'happy-dom',
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    exclude: [...configDefaults.exclude, 'src/demo/**'],
    setupFiles: ['tests/setup.ts'],
    restoreMocks: true,
  },
  define: {
    'import.meta.env.FIREFOX': JSON.stringify(name === 'firefox'),
    'import.meta.env.CHROME': JSON.stringify(name === 'chromium'),
  },
})

// The web demo's tests see the modules its build does: src/platform swapped
// for the fakes in src/demo/platform, and no WXT or browser APIs at all.
const demo = {
  plugins: [demoSwaps(), demoMessages(), solid()],
  resolve: { alias: demoAliases },
  define: { 'import.meta.env.FIREFOX': 'false', 'import.meta.env.CHROME': 'true' },
  test: {
    name: 'demo',
    environment: 'happy-dom',
    include: ['src/demo/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup-demo.ts'],
    restoreMocks: true,
  },
}

export default defineConfig({
  test: {
    projects: [target('chromium'), target('firefox'), demo],
  },
})
