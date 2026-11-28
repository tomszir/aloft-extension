import type { Plugin } from 'vite'
import solid from 'vite-plugin-solid'
import { configDefaults, defineConfig } from 'vitest/config'
import { WxtVitest } from 'wxt/testing/vitest-plugin'
import { demoMessages, demoSwaps } from './scripts/demo-plugins.ts'
import { demoAliases } from './vite.demo.config.ts'

// Each test runs once per build target. Vitest serves import.meta.env from an
// object of strings, so WxtVitest's FIREFOX comes through as "false", which
// would make every `if (import.meta.env.FIREFOX)` pass, and `define` can't
// override it. The target is written into the code instead, as the boolean
// the builds see.
const buildTarget = (firefox: boolean): Plugin => ({
  name: 'aloft:build-target',
  enforce: 'pre',
  transform(code, id) {
    if (id.includes('/node_modules/') || !code.includes('import.meta.env.')) return
    return code
      .replaceAll('import.meta.env.FIREFOX', String(firefox))
      .replaceAll('import.meta.env.CHROME', String(!firefox))
  },
})

// WxtVitest doesn't apply WXT modules' Vite plugins, so Solid's JSX
// transform is added here.
const target = (name: 'chromium' | 'firefox') => ({
  plugins: [buildTarget(name === 'firefox'), WxtVitest(), solid()],
  test: {
    name,
    environment: 'happy-dom',
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    exclude: [...configDefaults.exclude, 'src/demo/**'],
    setupFiles: ['tests/setup.ts'],
    restoreMocks: true,
    // Its own cache: the shared one would hand one target's transformed
    // module to the other, which keys it by the file's content alone.
    fsModuleCachePath: `node_modules/.vitest-cache/${name}`,
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
