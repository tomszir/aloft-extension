import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  type BrowserContext,
  test as base,
  chromium,
  type Page,
  type Worker,
} from '@playwright/test'

const EXTENSION_DIR = resolve('.output/chrome-mv3-e2e')

// Playwright's bundled Chromium by default; ALOFT_BROWSER points at another
// Chromium build, e.g. /usr/bin/helium-browser.
const executablePath = process.env.ALOFT_BROWSER || undefined

export const TEST_ORIGIN = 'https://aloft.test'

export const test = base.extend<{
  context: BrowserContext
  background: Worker
  /** Set with test.use({ darkSystem: true }) for a browser whose system preference is dark. */
  darkSystem: boolean
}>({
  darkSystem: [false, { option: true }],
  context: async ({ darkSystem }, use, testInfo) => {
    const profile = await mkdtemp(join(tmpdir(), 'aloft-e2e-'))
    const context = await chromium.launchPersistentContext(profile, {
      // Playwright's default headless build can't load extensions; its full
      // Chromium ("chromium" channel) can.
      ...(executablePath ? { executablePath } : { channel: 'chromium' }),
      headless: true,
      // Emulating the scheme would override prefers-color-scheme in every
      // frame and hide how a real preference reaches the palette's frame, so
      // dark comes from the browser itself instead.
      ...(darkSystem ? { colorScheme: null } : {}),
      args: [
        ...(darkSystem ? ['--force-dark-mode'] : []),
        `--disable-extensions-except=${EXTENSION_DIR}`,
        `--load-extension=${EXTENSION_DIR}`,
      ],
    })
    // Real sites would make the tests flaky and leak nothing useful; serve a
    // fixed page on a fake https origin instead.
    // The path becomes the page title, so tests can tell pages apart by name.
    await context.route(`${TEST_ORIGIN}/**`, (route) => {
      const title = decodeURIComponent(new URL(route.request().url()).pathname.slice(1))
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><title>${title || 'Test page'}</title><input id="field" aria-label="Field">`,
      })
    })
    // A fresh profile opens the onboarding tab once the install finishes, at
    // a moment no test can predict. Waiting for it here keeps it from being
    // taken for the tab a test is waiting on.
    const isOnboarding = (p: Page) => p.url().endsWith('/onboarding.html')
    await base.expect.poll(() => context.pages().some(isOnboarding)).toBe(true)
    // Some failures only happen on CI's slower runners, so keep a trace of
    // them there. The built-in trace option doesn't cover a context we launch.
    const trace = Boolean(process.env.CI)
    const logs: string[] = []
    if (trace) {
      await context.tracing.start({ screenshots: true, snapshots: true })
      context.on('console', (m) => logs.push(`${m.type()} ${m.location().url}: ${m.text()}`))
      context.on('weberror', (e) => logs.push(`error: ${e.error().stack ?? e.error().message}`))
    }
    await use(context)
    if (trace) {
      const failed = testInfo.status !== testInfo.expectedStatus
      await context.tracing.stop(failed ? { path: testInfo.outputPath('trace.zip') } : {})
      if (failed) await writeFile(testInfo.outputPath('console.txt'), logs.join('\n'))
    }
    await context.close()
    await rm(profile, { recursive: true, force: true })
  },
  background: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'))
    await use(worker)
  },
})

export const expect = test.expect

export async function activeTabUrl(background: Worker): Promise<string | undefined> {
  return background.evaluate(async () => {
    const api = Reflect.get(globalThis, 'chrome') as {
      tabs: { query: (query: object) => Promise<{ url?: string }[]> }
    }
    const [tab] = await api.tabs.query({ active: true, lastFocusedWindow: true })
    return tab?.url
  })
}

/**
 * For keys that make Aloft remove its own frame (Esc, Enter, Alt+digit). A real key
 * press waits for the keyup to be acknowledged by a frame that no longer
 * exists, and sometimes hangs until the test times out. dispatchEvent has the
 * same race on slow machines, so the event fires only after the call returns.
 */
export async function sendPaletteKey(
  page: Page,
  init: { key: string; code?: string; altKey?: boolean; shiftKey?: boolean },
): Promise<void> {
  await page
    .locator('iframe[title="Aloft"]')
    .contentFrame()
    .getByRole('combobox')
    .evaluate((input, options) => {
      setTimeout(() =>
        input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...options })),
      )
    }, init)
}

type TabCall = 'pin' | 'unpin' | 'discard'

/** Pins, unpins or puts to sleep the tab showing `url`. */
export async function tabAction(background: Worker, url: string, action: TabCall): Promise<void> {
  await background.evaluate(
    async ([target, call]) => {
      const api = Reflect.get(globalThis, 'chrome') as {
        tabs: {
          query: (q: object) => Promise<{ id?: number; url?: string }[]>
          update: (id: number, props: object) => Promise<unknown>
          discard: (id: number) => Promise<unknown>
        }
      }
      const tab = (await api.tabs.query({})).find((t) => t.url === target)
      if (tab?.id === undefined) throw new Error(`no tab for ${target}`)
      if (call === 'discard') await api.tabs.discard(tab.id)
      else await api.tabs.update(tab.id, { pinned: call === 'pin' })
    },
    [url, action] as const,
  )
}

export async function isPinned(background: Worker, url: string): Promise<boolean> {
  return background.evaluate(async (target) => {
    const api = Reflect.get(globalThis, 'chrome') as {
      tabs: { query: (q: object) => Promise<{ url?: string; pinned?: boolean }[]> }
    }
    return (await api.tabs.query({})).some((t) => t.url === target && t.pinned)
  }, url)
}

/** The pinned tabs' URLs in tab-strip order. */
export async function pinnedUrls(background: Worker): Promise<string[]> {
  return background.evaluate(async () => {
    const api = Reflect.get(globalThis, 'chrome') as {
      tabs: { query: (q: object) => Promise<{ url?: string; index: number }[]> }
    }
    const pins = await api.tabs.query({ pinned: true })
    return pins.sort((a, b) => a.index - b.index).map((t) => t.url ?? '')
  })
}

export async function setSettings(background: Worker, patch: object): Promise<void> {
  await background.evaluate(async (value) => {
    const api = Reflect.get(globalThis, 'chrome') as {
      storage: { sync: { set: (items: object) => Promise<void> } }
    }
    await api.storage.sync.set({ settings: value })
  }, patch)
}

/** Replaces the stored keywords, as the settings page would save them. */
export async function setKeywords(background: Worker, keywords: object): Promise<void> {
  await background.evaluate(async (value) => {
    const api = Reflect.get(globalThis, 'chrome') as {
      storage: { sync: { set: (items: object) => Promise<void> } }
    }
    await api.storage.sync.set({ keywords: value })
  }, keywords)
}

/** Runs the same code path as the Alt+Q shortcut, for the active tab. */
// Targets the page's own tab rather than "the active tab": the onboarding tab
// opens on install and can win that race.
export async function pressOpenAloft(background: Worker, page: Page): Promise<void> {
  await page.bringToFront()
  await background.evaluate(async (url) => {
    // This runs inside the service worker, where neither WXT's imports nor
    // the test file's types exist.
    type Tab = { id?: number; url?: string }
    const api = Reflect.get(globalThis, 'chrome') as {
      tabs: { query: (query: object) => Promise<Tab[]> }
    }
    const hooks = Reflect.get(globalThis, 'aloftTest') as {
      openAloft: (tab: Tab | undefined) => Promise<void>
    }
    const tabs = await api.tabs.query({})
    await hooks.openAloft(tabs.find((t) => t.url === url))
  }, page.url())
}

/**
 * Before clicking in the palette: until its frame has painted, Chromium sends
 * clicks to the page under it, though Playwright already counts it as visible.
 */
export async function palettePainted(page: Page): Promise<void> {
  await page
    .locator('iframe[title="Aloft"]')
    .contentFrame()
    .locator('body')
    .evaluate(
      () => new Promise((painted) => requestAnimationFrame(() => requestAnimationFrame(painted))),
    )
}
