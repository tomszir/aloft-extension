// The web demo build (docs/demo.md): `pnpm demo:build`. Separate from WXT's,
// so the extension's packages don't change with it.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import { demoInlineCss, demoMessages, demoRelease, demoSwaps } from './scripts/demo-plugins.ts'

const { version } = JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8'))

export const demoAliases = {
  '#i18n': resolve(import.meta.dirname, 'src/demo/i18n.ts'),
}

export default defineConfig({
  root: import.meta.dirname,
  publicDir: false,
  plugins: [demoSwaps(), demoMessages(), solid(), demoInlineCss(), demoRelease(version)],
  resolve: { alias: demoAliases },
  css: { modules: { localsConvention: 'camelCaseOnly' } },
  define: {
    // The demo behaves like the Chromium build; the platform code that would
    // differ is swapped out anyway.
    'import.meta.env.FIREFOX': 'false',
    'import.meta.env.CHROME': 'true',
    __ALOFT_VERSION__: JSON.stringify(version),
  },
  build: {
    outDir: '.output/demo',
    emptyOutDir: true,
    target: 'es2022',
    cssCodeSplit: false,
    lib: {
      entry: resolve(import.meta.dirname, 'src/demo/index.tsx'),
      formats: ['es'],
      fileName: () => 'aloft-demo.js',
    },
    rolldownOptions: {
      output: {
        // Vite leaves an ES library's whitespace in; this is a file to serve, not to bundle again.
        minify: !process.env.DEMO_NO_MINIFY,
        banner: `/*! Aloft demo ${version}. GPL-3.0-only. Source: https://github.com/tomszir/aloft-extension */`,
      },
    },
  },
})
