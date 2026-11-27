import { readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { resolve } from 'node:path'
import { test as base, expect } from '@playwright/test'
import { Browser as BrowserName, computeExecutablePath, install } from '@puppeteer/browsers'
import puppeteer, { type Browser, type Frame, type Page } from 'puppeteer-core'

// Playwright can't load extensions into Firefox; Puppeteer can, over
// WebDriver BiDi. Pinned so a Firefox release can't break a run by itself.
const FIREFOX_BUILD = 'stable_160.0.1'
const CACHE_DIR = resolve('node_modules/.cache/aloft-browsers')
const EXTENSION_DIR = resolve('.output/firefox-mv3-e2e')

const manifest: unknown = JSON.parse(readFileSync(resolve(EXTENSION_DIR, 'manifest.json'), 'utf8'))
const ADDON_ID: string = Reflect.get(
  Reflect.get(Reflect.get(Object(manifest), 'browser_specific_settings'), 'gecko'),
  'id',
)
// Firefox picks a random moz-extension:// host per install; a fixed one lets
// tests open Aloft's pages.
const UUID = '0a1f7000-0000-4000-8000-00000000a10f'
export const EXTENSION_ORIGIN = `moz-extension://${UUID}`

// Puppeteer reports the overlay frame as about:blank: its address can't be
// read from the page that holds it, but its document can.
export async function paletteFrame(page: Page): Promise<Frame> {
  let found: Frame | undefined
  await expect
    .poll(async () => {
      for (const frame of page.frames()) {
        const href = await frame.evaluate(() => location.href).catch(() => '')
        if (href.startsWith(`${EXTENSION_ORIGIN}/palette.html`)) found = frame
      }
      return found !== undefined
    })
    .toBe(true)
  const palette = found
  if (!palette) throw new Error('no palette frame')
  // Tests start from a palette that's ready for keys.
  await expect
    .poll(() => palette.evaluate(() => document.activeElement?.getAttribute('role')))
    .toBe('combobox')
  return palette
}

export const test = base.extend<
  { firefox: Browser; control: Page },
  { executablePath: string; origin: string }
>({
  executablePath: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright requires a destructured first argument.
    async ({}, use) => {
      await install({ browser: BrowserName.FIREFOX, buildId: FIREFOX_BUILD, cacheDir: CACHE_DIR })
      await use(
        computeExecutablePath({
          browser: BrowserName.FIREFOX,
          buildId: FIREFOX_BUILD,
          cacheDir: CACHE_DIR,
        }),
      )
    },
    { scope: 'worker', timeout: 300_000 },
  ],
  // A real server, since Puppeteer has no request routing for Firefox. The
  // path becomes the page title; /strict pages send a CSP that forbids frames.
  origin: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright requires a destructured first argument.
    async ({}, use) => {
      const server: Server = createServer((request, response) => {
        const path = new URL(request.url ?? '/', 'http://localhost').pathname
        response.writeHead(200, {
          'content-type': 'text/html',
          ...(path.startsWith('/strict')
            ? { 'content-security-policy': "default-src 'none'; frame-src 'none'" }
            : {}),
        })
        const title = decodeURIComponent(path.slice(1)) || 'Test page'
        response.end(`<!doctype html><title>${title}</title><input id="field" aria-label="Field">`)
      })
      await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
      const { port } = server.address() as AddressInfo
      await use(`http://127.0.0.1:${port}`)
      await new Promise((done) => server.close(done))
    },
    { scope: 'worker' },
  ],
  firefox: async ({ executablePath }, use) => {
    const browser = await puppeteer.launch({
      browser: 'firefox',
      executablePath,
      headless: true,
      // Lets the tests reach moz-extension:// pages and frames.
      env: { ...process.env, MOZ_REMOTE_ALLOW_SYSTEM_ACCESS: '1' },
      extraPrefsFirefox: {
        'extensions.webextensions.uuids': JSON.stringify({ [ADDON_ID]: UUID }),
      },
    })
    await browser.installExtension(EXTENSION_DIR)
    await use(browser)
    await browser.close()
  },
  // An Aloft page to run extension calls from. The background's own scripts
  // can't be evaluated in: its CSP blocks eval.
  control: async ({ firefox }, use) => {
    const control = await firefox.newPage()
    // Extension pages never report finishing loading over BiDi, so the
    // navigation is left running and the page polled until it's usable.
    void control.goto(`${EXTENSION_ORIGIN}/options.html`).catch(() => {})
    await expect
      .poll(() => control.evaluate(() => typeof Reflect.get(globalThis, 'browser')).catch(() => ''))
      .toBe('object')
    // A fresh profile opens the onboarding tab once the install finishes. If
    // that lands mid-test it becomes the tab Ctrl+T returns to.
    await expect.poll(() => tabUrls(control)).toContain(`${EXTENSION_ORIGIN}/onboarding.html`)
    await use(control)
  },
})

export { expect }

// These run inside an Aloft page, where neither WXT's imports nor the test
// file's types exist.
type Tab = { id?: number; url?: string; active?: boolean }
type Api = {
  tabs: {
    query: (query: object) => Promise<Tab[]>
    update: (id: number, props: object) => Promise<unknown>
    create: (props: object) => Promise<Tab>
  }
  runtime: { getBackgroundPage: () => Promise<object> }
}

export function tabUrls(control: Page): Promise<string[]> {
  return control.evaluate(async () => {
    const api = Reflect.get(globalThis, 'browser') as Api
    return (await api.tabs.query({})).map((t) => t.url ?? '')
  })
}

export function activeTabUrl(control: Page): Promise<string | undefined> {
  return control.evaluate(async () => {
    const api = Reflect.get(globalThis, 'browser') as Api
    return (await api.tabs.query({ active: true, lastFocusedWindow: true }))[0]?.url
  })
}

/** Opens a page in a new tab and makes it the one in use. */
export async function openPage(firefox: Browser, control: Page, url: string): Promise<Page> {
  const page = await firefox.newPage()
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await control.evaluate(async (target) => {
    const api = Reflect.get(globalThis, 'browser') as Api
    const tab = (await api.tabs.query({})).find((t) => t.url === target)
    if (tab?.id === undefined) throw new Error(`no tab for ${target}`)
    await api.tabs.update(tab.id, { active: true })
  }, page.url())
  return page
}

/** Runs the same code path as the Alt+Q shortcut, for the tab showing `page`. */
export async function pressOpenAloft(control: Page, page: Page): Promise<void> {
  await control.evaluate(async (target) => {
    const api = Reflect.get(globalThis, 'browser') as Api
    const background = await api.runtime.getBackgroundPage()
    const hooks = Reflect.get(background, 'aloftTest') as {
      openAloft: (tab?: Tab) => Promise<void>
    }
    await hooks.openAloft((await api.tabs.query({})).find((t) => t.url === target))
  }, page.url())
}

/** What Ctrl+T does: an active tab on the browser's new tab page. */
export async function pressNewTab(control: Page): Promise<void> {
  await control.evaluate(async () => {
    const api = Reflect.get(globalThis, 'browser') as Api
    await api.tabs.create({})
  })
}

/** Pins or unpins the tab showing `url`. */
export async function setPinned(control: Page, url: string, pinned: boolean): Promise<void> {
  await control.evaluate(
    async (target, value) => {
      const api = Reflect.get(globalThis, 'browser') as Api
      const tab = (await api.tabs.query({})).find((t) => t.url === target)
      if (tab?.id === undefined) throw new Error(`no tab for ${target}`)
      await api.tabs.update(tab.id, { pinned: value })
    },
    url,
    pinned,
  )
}

export function isPinned(control: Page, url: string): Promise<boolean> {
  return control.evaluate(async (target) => {
    const api = Reflect.get(globalThis, 'browser') as Api
    const tabs = (await api.tabs.query({})) as { url?: string; pinned?: boolean }[]
    return tabs.some((t) => t.url === target && t.pinned === true)
  }, url)
}

/** Replaces the stored keywords, as the settings page would save them. */
export async function setKeywords(control: Page, keywords: object): Promise<void> {
  await control.evaluate(async (value) => {
    const api = Reflect.get(globalThis, 'browser') as {
      storage: { sync: { set: (items: object) => Promise<void> } }
    }
    await api.storage.sync.set({ keywords: value })
  }, keywords)
}

/** The palette's visible text, or that of its selected row. */
export const paletteText = (palette: Frame) =>
  palette.evaluate(() => document.body.textContent ?? '')
export const selectedRow = (palette: Frame) =>
  palette.evaluate(() => document.querySelector('[aria-selected="true"]')?.textContent ?? '')

export function recentlyClosedUrls(control: Page): Promise<string[]> {
  return control.evaluate(async () => {
    const api = Reflect.get(globalThis, 'browser') as {
      sessions: { getRecentlyClosed: () => Promise<{ tab?: { url?: string } }[]> }
    }
    return (await api.sessions.getRecentlyClosed()).flatMap((s) => (s.tab?.url ? [s.tab.url] : []))
  })
}
