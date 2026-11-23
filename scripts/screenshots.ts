// Store and README screenshots, taken from the real extension in a real
// browser so they never drift from the UI. Run with `pnpm screenshots`, which
// builds the e2e variant first (it has the site access the overlay needs).
//
// The demo sites are invented and served on a fake domain: no real brands,
// and nothing leaves the machine.
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { type BrowserContext, chromium, type Page, type Worker } from '@playwright/test'

const EXTENSION = resolve('.output/chrome-mv3-e2e')
const OUT = resolve('docs/screenshots')
// The size the Chrome Web Store asks for (it shows them at half size).
const VIEWPORT = { width: 1280, height: 800 }
const executablePath = process.env.ALOFT_BROWSER || undefined

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
  SITE('notes', 'Keyboard-first browsing — Field Notes', '#EF4444'),
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

async function setSettings(worker: Worker, value: object) {
  await worker.evaluate(async (v) => {
    const api = Reflect.get(globalThis, 'chrome') as Chrome
    await api.storage.sync.set({ settings: v })
  }, value)
}

// A real key press can hang when Escape removes the frame mid-press.
async function closeAloft(page: Page) {
  await page
    .locator('iframe[title="Aloft"]')
    .contentFrame()
    .getByRole('combobox')
    .dispatchEvent('keydown', { key: 'Escape', bubbles: true })
  await page.locator('iframe[title="Aloft"]').waitFor({ state: 'detached' })
}

async function openAloft(worker: Worker, page: Page) {
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

async function settle(page: Page) {
  // Let favicons decode and the enter animation finish.
  await page.waitForTimeout(600)
}

async function shoot(page: Page, name: string) {
  await page.screenshot({ path: join(OUT, `${name}.png`), animations: 'disabled', caret: 'hide' })
  console.log(`docs/screenshots/${name}.png`)
}

const profile = await mkdtemp(join(tmpdir(), 'aloft-screens-'))
const context = await chromium.launchPersistentContext(profile, {
  ...(executablePath ? { executablePath } : { channel: 'chromium' }),
  headless: true,
  viewport: VIEWPORT,
  deviceScaleFactor: 1,
  colorScheme: 'dark',
  args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
})

try {
  await mkdir(OUT, { recursive: true })
  await serveDemoSites(context)
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'))

  await openTabs(context, worker, [...PINS, ...TABS, CLOSED].map(url))
  for (const site of PINS) await setPinned(worker, url(site))
  await addBookmark(worker, { title: BOOKMARK.title, url: url(BOOKMARK) })
  for (const p of context.pages()) {
    if (p.url() === url(CLOSED) || p.url().startsWith('about:') || p.url().includes('onboarding')) {
      await p.close()
    }
  }

  const host = context.pages().find((p) => p.url() === url(TABS[0] as Site))
  if (!host) throw new Error('demo page missing')

  let frame = await openAloft(worker, host)
  await settle(host)
  await shoot(host, '1-pinned-and-tabs')

  await frame.getByRole('combobox').fill('keyboard')
  await settle(host)
  await shoot(host, '2-search')

  await frame.getByRole('combobox').fill('>')
  await settle(host)
  await shoot(host, '3-actions')

  await closeAloft(host)
  await setSettings(worker, { appearance: { colorScheme: 'light' } })
  await host.emulateMedia({ colorScheme: 'light' })
  frame = await openAloft(worker, host)
  await frame.getByRole('combobox').fill('trip')
  await settle(host)
  await shoot(host, '4-light')

  await closeAloft(host)
  await setSettings(worker, { appearance: { colorScheme: 'dark', darkTheme: 'moss' } })
  await host.emulateMedia({ colorScheme: 'dark' })
  frame = await openAloft(worker, host)
  await frame.getByRole('combobox').fill('handbook')
  await settle(host)
  await shoot(host, '5-themes')
} finally {
  await context.close()
  await rm(profile, { recursive: true, force: true })
}
