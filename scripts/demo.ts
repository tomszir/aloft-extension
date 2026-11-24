// The demo browser behind the store screenshots and the marquee tile: the real
// extension, with invented sites served on a fake domain, so there are no real
// brands and nothing leaves the machine. Needs the e2e build (`wxt build
// --mode e2e`), which has the site access the overlay needs.
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { type BrowserContext, chromium, type Page, type Worker } from '@playwright/test'

const EXTENSION = resolve('.output/chrome-mv3-e2e')
// The size the Chrome Web Store asks for. Pages are captured at twice that
// density, so the palette stays sharp once it's cropped and scaled up.
export const VIEWPORT = { width: 1280, height: 800 }
export const executablePath = process.env.ALOFT_BROWSER || undefined

interface Site {
  host: string
  title: string
  color: string
  letter: string
}

const SITE = (host: string, title: string, color: string): Site => ({
  host,
  title,
  color,
  letter: title.charAt(0),
})

const PINS = [
  SITE('mail', 'Inbox — Postbox', '#3B82F6'),
  SITE('calendar', 'Week 48 — Daybook', '#10B981'),
  SITE('chat', 'Team chat — Murmur', '#8B5CF6'),
  SITE('music', 'Focus mix — Tones', '#F59E0B'),
]
const TABS = [
  // The page behind the palette; its accent shows around every crop, so it
  // stays in the brand's blues instead of clashing with them.
  SITE('notes', 'Keyboard-first browsing — Field Notes', '#6366F1'),
  SITE('docs', 'Release checklist — Handbook', '#0EA5E9'),
  SITE('maps', 'Weekend trip — Waypoint', '#22C55E'),
]
const CLOSED = SITE('recipes', 'Sourdough, step by step — Crumb', '#D97706')
const BOOKMARK = SITE('keys', 'Keyboard shortcuts reference — Handbook', '#0EA5E9')

const url = (site: Site) => `https://${site.host}.aloft.test/`

function favicon(site: Site): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${site.color}"/><text x="16" y="22" font-family="system-ui,sans-serif" font-size="18" font-weight="700" fill="#fff" text-anchor="middle">${site.letter}</text></svg>`
}

// A plausible page to sit behind the overlay; it's dimmed, so it only needs
// shape and rhythm, not real content.
function page(site: Site): string {
  const [heading, brand] = site.title.split(' — ')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${site.title}</title>
<link rel="icon" href="/favicon.svg">
<style>
:root{color-scheme:light dark;--bg:#fbfbfa;--fg:#1c1e1e;--muted:#6b6f6f;--card:#f0f1f0;--accent:${site.color}}
@media (prefers-color-scheme:dark){:root{--bg:#141616;--fg:#e8e8e8;--muted:#9a9e9e;--card:#1f2121}}
body{margin:0;background:var(--bg);color:var(--fg);font:17px/1.65 Georgia,serif}
header{display:flex;align-items:center;gap:12px;padding:20px 64px;font:600 15px system-ui,sans-serif;border-bottom:1px solid var(--card)}
header i{width:22px;height:22px;border-radius:6px;background:var(--accent)}
header nav{margin-left:auto;display:flex;gap:24px;color:var(--muted);font-weight:500}
main{max-width:700px;margin:56px auto;padding:0 24px}
h1{font:700 44px/1.15 system-ui,sans-serif;margin:0 0 12px}
.meta{color:var(--muted);font:14px system-ui,sans-serif;margin-bottom:36px}
figure{margin:32px 0;height:220px;border-radius:14px;background:linear-gradient(135deg,var(--accent),var(--card))}
</style></head><body>
<header><i></i>${brand ?? ''}<nav><span>Latest</span><span>Archive</span><span>About</span></nav></header>
<main><h1>${heading}</h1><div class="meta">8 min read · November 2026</div>
<p>Most of what we do in a browser starts the same way: open something, find something, go back to something. The faster that first step is, the less it gets in the way of the work itself.</p>
<figure></figure>
<p>A command bar that floats over the page keeps you where you were. Your tabs, history and bookmarks are one search away, and nothing about the page you're reading changes while you look.</p>
<p>Pinned tabs sit at the top, a keystroke each. Everything else is a few letters of its title.</p>
</main></body></html>`
}

async function serveDemoSites(context: BrowserContext) {
  const sites = new Map([...PINS, ...TABS, CLOSED, BOOKMARK].map((s) => [s.host, s]))
  await context.route('https://*.aloft.test/**', (route) => {
    const { hostname, pathname } = new URL(route.request().url())
    const site = sites.get(hostname.split('.')[0] ?? '')
    if (!site) return route.fulfill({ status: 404, body: '' })
    if (pathname === '/favicon.svg') {
      return route.fulfill({ contentType: 'image/svg+xml', body: favicon(site) })
    }
    return route.fulfill({ contentType: 'text/html', body: page(site) })
  })
}

type Chrome = {
  tabs: {
    query: (q: object) => Promise<{ id?: number; url?: string }[]>
    update: (id: number, props: object) => Promise<unknown>
    create: (props: object) => Promise<unknown>
  }
  bookmarks: { create: (props: object) => Promise<unknown> }
  storage: { sync: { set: (items: object) => Promise<void> } }
}

async function setPinned(worker: Worker, target: string) {
  await worker.evaluate(async (u) => {
    const api = Reflect.get(globalThis, 'chrome') as Chrome
    const tab = (await api.tabs.query({})).find((t) => t.url === u)
    if (tab?.id !== undefined) await api.tabs.update(tab.id, { pinned: true })
  }, target)
}

async function addBookmark(worker: Worker, site: { title: string; url: string }) {
  await worker.evaluate(async (b) => {
    const api = Reflect.get(globalThis, 'chrome') as Chrome
    await api.bookmarks.create(b)
  }, site)
}

export async function setSettings(worker: Worker, value: object) {
  await worker.evaluate(async (v) => {
    const api = Reflect.get(globalThis, 'chrome') as Chrome
    await api.storage.sync.set({ settings: v })
  }, value)
}

// A real key press can hang when Escape removes the frame mid-press.
export async function closeAloft(page: Page) {
  await page
    .locator('iframe[title="Aloft"]')
    .contentFrame()
    .getByRole('combobox')
    .dispatchEvent('keydown', { key: 'Escape', bubbles: true })
  await page.locator('iframe[title="Aloft"]').waitFor({ state: 'detached' })
}

export async function openAloft(worker: Worker, page: Page) {
  await page.bringToFront()
  await worker.evaluate(async (target) => {
    const api = Reflect.get(globalThis, 'chrome') as Chrome
    const hooks = Reflect.get(globalThis, 'aloftTest') as {
      openAloft: (tab: unknown) => Promise<void>
    }
    const tab = (await api.tabs.query({})).find((t) => t.url === target)
    await hooks.openAloft(tab)
  }, page.url())
  const frame = page.locator('iframe[title="Aloft"]').contentFrame()
  await frame.getByRole('combobox').waitFor()
  return frame
}

// Playwright's newPage() + goto() races the new tab's own about:blank in
// headless Helium, tabs the extension opens straight onto a URL load before
// Playwright's routes attach, and Helium may stop loading background tabs. So
// the extension opens each tab in front on a marked blank page, and
// Playwright navigates it once it has found it.
async function openTabs(context: BrowserContext, worker: Worker, urls: string[]) {
  for (const [i, target] of urls.entries()) {
    const mark = `about:blank#aloft-demo-${i}`
    await worker.evaluate(async (u) => {
      const api = Reflect.get(globalThis, 'chrome') as Chrome
      await api.tabs.create({ url: u, active: true })
    }, mark)
    const deadline = Date.now() + 15_000
    let page = context.pages().find((p) => p.url() === mark)
    while (!page) {
      if (Date.now() > deadline) throw new Error(`demo tab ${mark} didn't open`)
      await new Promise((r) => setTimeout(r, 50))
      page = context.pages().find((p) => p.url() === mark)
    }
    await gotoSettled(page, target)
  }
}

// A fresh profile's first seconds are noisy: Helium's built-in uBlock Origin
// reloads tabs that started before its filter lists were ready, which aborts
// navigations. Retry those instead of failing the whole run.
async function gotoSettled(page: Page, target: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      await page.goto(target)
      return
    } catch (error) {
      const interrupted = /ERR_ABORTED|interrupted by another navigation/.test(String(error))
      if (attempt === 5 || !interrupted) throw error
      await page.waitForTimeout(500)
    }
  }
}

export async function settle(page: Page) {
  // Let favicons decode and the enter animation finish.
  await page.waitForTimeout(600)
}

export interface Crop {
  x: number
  y: number
  width: number
  height: number
}

/** The palette's panel plus `margin` of the page around it, in CSS pixels. */
export async function paletteCrop(page: Page, margin: number): Promise<Crop> {
  const size = await page.evaluate(() => [innerWidth, innerHeight, devicePixelRatio])
  if (size.join() !== `${VIEWPORT.width},${VIEWPORT.height},2`) {
    throw new Error(`expected a ${VIEWPORT.width}x${VIEWPORT.height} page at 2x, got ${size}`)
  }
  const panel = await page
    .locator('iframe[title="Aloft"]')
    .contentFrame()
    .getByRole('dialog')
    .boundingBox()
  if (!panel) throw new Error('palette not visible')
  const x = Math.max(0, panel.x - margin)
  const y = Math.max(0, panel.y - margin)
  return {
    x,
    y,
    width: Math.min(VIEWPORT.width, panel.x + panel.width + margin) - x,
    height: Math.min(VIEWPORT.height, panel.y + panel.height + margin) - y,
  }
}

export interface Demo {
  context: BrowserContext
  worker: Worker
  /** The page Aloft opens over. */
  host: Page
  close: () => Promise<void>
}

export async function launchDemo(): Promise<Demo> {
  const profile = await mkdtemp(join(tmpdir(), 'aloft-demo-'))
  const context = await chromium.launchPersistentContext(profile, {
    ...(executablePath ? { executablePath } : { channel: 'chromium' }),
    headless: true,
    // No emulated viewport: Playwright's emulation forces the scale back to 1x.
    viewport: null,
    colorScheme: 'dark',
    args: [
      `--disable-extensions-except=${EXTENSION}`,
      `--load-extension=${EXTENSION}`,
      // Real 2x rather than Playwright's emulated deviceScaleFactor, which the
      // palette's out-of-process frame doesn't get: it paints only part of it.
      '--force-device-scale-factor=2',
      // The window's own frame takes the difference; paletteCrop() checks it.
      `--window-size=${VIEWPORT.width},${VIEWPORT.height + 87}`,
    ],
  })
  const close = async () => {
    await context.close()
    await rm(profile, { recursive: true, force: true })
  }
  try {
    await serveDemoSites(context)
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'))
    await openTabs(context, worker, [...PINS, ...TABS, CLOSED].map(url))
    for (const site of PINS) await setPinned(worker, url(site))
    await addBookmark(worker, { title: BOOKMARK.title, url: url(BOOKMARK) })
    for (const p of context.pages()) {
      if (
        p.url() === url(CLOSED) ||
        p.url().startsWith('about:') ||
        p.url().includes('onboarding')
      ) {
        await p.close()
      }
    }
    const host = context.pages().find((p) => p.url() === url(TABS[0] as Site))
    if (!host) throw new Error('demo page missing')
    return { context, worker, host, close }
  } catch (error) {
    await close()
    throw error
  }
}
