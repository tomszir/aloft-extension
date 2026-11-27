// Vite plugins for the web demo (docs/demo.md). The demo is the extension's
// own palette code with src/platform swapped for in-memory fakes, bundled into
// one ES module that a page with a strict CSP can load.
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import { generateChromeMessages, parseMessagesFile } from '@wxt-dev/i18n/build'
import type { Plugin } from 'vite'

const ROOT = resolve(import.meta.dirname, '..')
const SRC = join(ROOT, 'src')
const DEMO = join(SRC, 'demo')

/** Modules the demo swaps for its own, by folder: every platform module, and the app glue that touches the page's root. */
const SWAPPED = ['platform', 'app'] as const

// Anything that reaches the extension APIs must have gone through a swap.
const FORBIDDEN = /^(wxt|wxt\/.*|#imports|@wxt-dev\/browser|webextension-polyfill)$/

const stripQuery = (id: string) => id.replace(/[?#].*$/, '')

/**
 * Redirects imports of src/platform/<name> and src/app/<name> to
 * src/demo/platform/<name> and src/demo/app/<name>. A platform module without
 * a fake fails the build, so no browser call can slip into the demo. Imports
 * from inside src/demo reach the real modules, so a fake can wrap one.
 */
export function demoSwaps(): Plugin {
  return {
    name: 'aloft-demo:swaps',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (FORBIDDEN.test(source)) {
        throw new Error(`Aloft demo: ${importer ?? '?'} imports ${source}, an extension API`)
      }
      if (!importer || stripQuery(importer).startsWith(DEMO + sep)) return null
      // Relative imports only: an absolute one was already resolved, maybe to a stand-in.
      if (!source.startsWith('.')) return null
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      if (!resolved) return null
      const file = stripQuery(resolved.id)
      for (const folder of SWAPPED) {
        const base = join(SRC, folder) + sep
        if (!file.startsWith(base)) continue
        const fake = join(DEMO, folder, relative(base, file))
        if (existsSync(fake)) return fake
        if (folder === 'platform') {
          throw new Error(
            `Aloft demo: ${relative(ROOT, file)} has no stand-in in src/demo/platform/`,
          )
        }
      }
      return null
    },
  }
}

const MESSAGES_ID = 'virtual:aloft-messages'

const MESSAGES_PLACEHOLDER = '__ALOFT_DEMO_MESSAGES__'

/**
 * `virtual:aloft-messages`: the extension's strings plus the demo's own, as
 * plain text. A build keeps only the keys some bundled module names in a
 * string literal, which is how every key is used (src/locales has no keys
 * built from parts).
 */
export function demoMessages(): Plugin {
  const resolvedId = `\0${MESSAGES_ID}`
  const files = [join(SRC, 'locales/en.yml'), join(DEMO, 'locales/en.yml')]
  let building = false
  let all: Record<string, string> = {}
  return {
    name: 'aloft-demo:messages',
    configResolved(config) {
      building = config.command === 'build'
    },
    resolveId: (id) => (id === MESSAGES_ID ? resolvedId : null),
    async load(id) {
      if (id !== resolvedId) return null
      all = {}
      for (const file of files) {
        this.addWatchFile(file)
        // The same text the extension's messages.json gets from these files.
        const chrome = generateChromeMessages(await parseMessagesFile(file))
        for (const [key, { message }] of Object.entries(chrome)) {
          if (key in all) throw new Error(`Aloft demo: message ${key} is defined twice`)
          all[key] = message
        }
      }
      return building
        ? `export default JSON.parse(${JSON.stringify(MESSAGES_PLACEHOLDER)})`
        : `export default ${JSON.stringify(all)}`
    },
    async generateBundle(_options, bundle) {
      if (!building) return
      for (const file of Object.values(bundle)) {
        if (file.type !== 'chunk') continue
        const marker = new RegExp(`(["'\`])${MESSAGES_PLACEHOLDER}\\1`)
        if (!marker.test(file.code)) continue
        const sources = await Promise.all(
          file.moduleIds
            .filter((id) => id.startsWith(SRC + sep) && !id.includes('/locales/'))
            .map((id) => readFile(stripQuery(id), 'utf8')),
        )
        const literals = new Set(
          sources.flatMap((code) =>
            [...code.matchAll(/['"`]([A-Za-z]\w*)['"`]/g)].map((m) => m[1]),
          ),
        )
        const used = Object.fromEntries(Object.entries(all).filter(([key]) => literals.has(key)))
        file.code = file.code.replace(marker, () => JSON.stringify(JSON.stringify(used)))
      }
    },
  }
}

export const CSS_PLACEHOLDER = '__ALOFT_DEMO_CSS__'

/**
 * Takes the bundle's CSS out of its own file and into the script, where the
 * demo adopts it as a constructed stylesheet in its shadow root: the page's CSP
 * allows no other kind of style it didn't hash. Tokens declared on :root apply
 * to the shadow host instead, and :root[data-scheme] to the demo's themed
 * element.
 */
export function demoInlineCss(): Plugin {
  return {
    name: 'aloft-demo:inline-css',
    enforce: 'post',
    generateBundle(_options, bundle) {
      let css = ''
      for (const [name, file] of Object.entries(bundle)) {
        if (file.type === 'asset' && name.endsWith('.css')) {
          css += String(file.source)
          delete bundle[name]
        }
      }
      css = css.replace(/:root(?=\[)/g, '').replace(/:root\b/g, ':host')
      let placed = false
      for (const file of Object.values(bundle)) {
        if (file.type !== 'chunk') continue
        const marker = new RegExp(`(["'\`])${CSS_PLACEHOLDER}\\1`)
        if (!marker.test(file.code)) continue
        file.code = file.code.replace(marker, () => JSON.stringify(css))
        placed = true
      }
      if (!placed) this.error(`no ${CSS_PLACEHOLDER} in the bundle for the demo's styles`)
    },
  }
}

// Things the page's CSP or Aloft's privacy promise rule out. A match fails the
// build rather than waiting for someone to notice in a browser.
const BANNED: readonly [RegExp, string][] = [
  [/\bimport\.meta\b/, 'import.meta (the file must not depend on where it is served from)'],
  [/\beval\s*\(/, 'eval'],
  [/\bnew\s+Function\s*\(/, 'new Function'],
  [/\bfetch\s*\(/, 'fetch (no network requests)'],
  [/\bXMLHttpRequest\b/, 'XMLHttpRequest (no network requests)'],
  [/\bWebSocket\b/, 'WebSocket (no network requests)'],
  [/\bsendBeacon\b/, 'sendBeacon (no network requests)'],
  [/\bimport\s*\(/, 'dynamic import (the demo is one file)'],
]

/**
 * Checks the finished file, then writes the release copies next to it:
 * aloft-demo-<version>.js and its SHA-256, as attached to GitHub releases.
 */
export function demoRelease(version: string): Plugin {
  let outDir = ''
  return {
    name: 'aloft-demo:release',
    enforce: 'post',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    generateBundle(_options, bundle) {
      const files = Object.values(bundle)
      if (files.length !== 1) {
        this.error(`the demo must be one file, got ${files.map((f) => f.fileName).join(', ')}`)
      }
      for (const file of files) {
        if (file.type !== 'chunk') continue
        for (const [pattern, what] of BANNED) {
          if (pattern.test(file.code)) this.error(`${file.fileName} uses ${what}`)
        }
      }
    },
    async writeBundle(_options, bundle) {
      const chunk = Object.values(bundle).find((f) => f.type === 'chunk')
      if (chunk?.type !== 'chunk') return
      const name = `aloft-demo-${version}.js`
      const digest = createHash('sha256').update(chunk.code).digest('hex')
      await writeFile(join(outDir, name), chunk.code)
      await writeFile(join(outDir, `${name}.sha256`), `${digest}  ${name}\n`)
    },
  }
}
