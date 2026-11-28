import type { Page } from 'puppeteer-core'
import {
  activeTabUrl,
  EXTENSION_ORIGIN,
  expect,
  isPinned,
  openPage,
  paletteFrame,
  pressOpenAloft,
  recentlyClosedUrls,
  selectedRow,
  tabUrls,
  test,
} from './fixtures'

// Every action reaches the browser through the background in Firefox, since
// the palette's frame has no tabs, windows or sessions API there.

async function runAction(page: Page, control: Page, query: string, name: string) {
  await pressOpenAloft(control, page)
  const palette = await paletteFrame(page)
  await page.keyboard.type(query)
  await expect.poll(() => selectedRow(palette)).toContain(name)
  await page.keyboard.press('Enter')
}

test('pins the tab Aloft is open over', async ({ firefox, control, origin }) => {
  const page = await openPage(firefox, control, `${origin}/Host`)

  await runAction(page, control, '> pin', 'Pin tab')

  await expect.poll(() => isPinned(control, page.url())).toBe(true)
})

test('duplicates the tab', async ({ firefox, control, origin }) => {
  const page = await openPage(firefox, control, `${origin}/Host`)

  await runAction(page, control, '> dup', 'Duplicate tab')

  await expect
    .poll(async () => (await tabUrls(control)).filter((url) => url === page.url()).length)
    .toBe(2)
})

test('reopens the last closed tab', async ({ firefox, control, origin }) => {
  const closing = await openPage(firefox, control, `${origin}/Closed-one`)
  await closing.close()
  // Firefox records closed tabs a moment later; a palette opened first would
  // have nothing to reopen.
  await expect.poll(() => recentlyClosedUrls(control)).toContain(`${origin}/Closed-one`)
  const page = await openPage(firefox, control, `${origin}/Host`)

  await runAction(page, control, '> undo', 'Reopen closed tab')

  await expect.poll(() => tabUrls(control)).toContain(`${origin}/Closed-one`)
})

test("> doesn't offer Firefox's own pages, which it won't open for an extension", async ({
  firefox,
  control,
  origin,
}) => {
  const page = await openPage(firefox, control, `${origin}/Host`)
  await pressOpenAloft(control, page)
  const palette = await paletteFrame(page)
  await page.keyboard.type('> extensions')

  await expect
    .poll(() => palette.evaluate(() => document.querySelector('[role="status"]')?.textContent))
    .toBe('No matching actions')
})

test('> open settings opens the settings page', async ({ firefox, control, origin }) => {
  const page = await openPage(firefox, control, `${origin}/Host`)

  await runAction(page, control, '> settings', 'Aloft settings')

  await expect.poll(() => activeTabUrl(control)).toBe(`${EXTENSION_ORIGIN}/options.html`)
})

type Tab = { id?: number; url?: string; windowId?: number; mutedInfo?: { muted: boolean } }
type Api = {
  tabs: {
    query: (q: object) => Promise<Tab[]>
    update: (id: number, props: object) => Promise<unknown>
  }
  windows: {
    create: (props: object) => Promise<{ id?: number }>
    update: (id: number, props: object) => Promise<unknown>
  }
  bookmarks: { search: (q: object) => Promise<unknown[]> }
}

const tabAt = (control: Page, url: string) =>
  control.evaluate(async (target) => {
    const api = Reflect.get(globalThis, 'browser') as Api
    return (await api.tabs.query({})).find((t) => t.url === target)
  }, url)

const bookmarkCount = (control: Page, url: string) =>
  control.evaluate(async (target) => {
    const api = Reflect.get(globalThis, 'browser') as Api
    return (await api.bookmarks.search({ url: target })).length
  }, url)

test('closes the tab', async ({ firefox, control, origin }) => {
  const page = await openPage(firefox, control, `${origin}/Host`)

  await runAction(page, control, '> close tab', 'Close tab')

  await expect.poll(() => tabUrls(control)).not.toContain(`${origin}/Host`)
})

test('unmutes a muted tab', async ({ firefox, control, origin }) => {
  const page = await openPage(firefox, control, `${origin}/Host`)
  await control.evaluate(async (target) => {
    const api = Reflect.get(globalThis, 'browser') as Api
    const tab = (await api.tabs.query({})).find((t) => t.url === target)
    if (tab?.id !== undefined) await api.tabs.update(tab.id, { muted: true })
  }, page.url())

  await runAction(page, control, '> unmute', 'Unmute tab')

  await expect.poll(async () => (await tabAt(control, page.url()))?.mutedInfo?.muted).toBe(false)
})

test('bookmarks the page, then removes the bookmark', async ({ firefox, control, origin }) => {
  const page = await openPage(firefox, control, `${origin}/Host`)

  await runAction(page, control, '> bookmark this', 'Bookmark this page')
  await expect.poll(() => bookmarkCount(control, page.url())).toBe(1)

  await runAction(page, control, '> remove bookmark', 'Remove bookmark')
  await expect.poll(() => bookmarkCount(control, page.url())).toBe(0)
})

test("closes the window's duplicate tabs, keeping this one", async ({
  firefox,
  control,
  origin,
}) => {
  for (const path of ['Copy', 'Copy#part', 'Host#top'])
    await openPage(firefox, control, `${origin}/${path}`)
  const page = await openPage(firefox, control, `${origin}/Host`)

  await runAction(page, control, '> duplicates', 'Close duplicate tabs')

  await expect
    .poll(async () => (await tabUrls(control)).filter((url) => url.startsWith(origin)).sort())
    .toEqual([`${origin}/Copy#part`, `${origin}/Host`])
})

test('moves the tab to another window', async ({ firefox, control, origin }) => {
  const page = await openPage(firefox, control, `${origin}/Host`)
  const other = await control.evaluate(async (url) => {
    const api = Reflect.get(globalThis, 'browser') as Api
    return (await api.windows.create({ url })).id
  }, `${origin}/Elsewhere`)
  await expect
    .poll(async () => (await tabAt(control, `${origin}/Elsewhere`)) !== undefined)
    .toBe(true)
  // Back to the host's window, as the person would be when opening Aloft there.
  await control.evaluate(async (target) => {
    const api = Reflect.get(globalThis, 'browser') as Api
    const tab = (await api.tabs.query({})).find((t) => t.url === target)
    if (tab?.windowId !== undefined) await api.windows.update(tab.windowId, { focused: true })
  }, page.url())

  await runAction(page, control, '> move', 'Move tab to the window with Elsewhere')

  await expect.poll(async () => (await tabAt(control, page.url()))?.windowId).toBe(other)
})
