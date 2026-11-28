import type { Page, Worker } from '@playwright/test'
import {
  activeTabUrl,
  expect,
  isPinned,
  palettePainted,
  pressOpenAloft,
  sendPaletteKey,
  TEST_ORIGIN,
  test,
} from './fixtures'

const palette = (page: Page) => page.locator('iframe[title="Aloft"]').contentFrame()

async function runAction(page: Page, query: string, name: string) {
  await palettePainted(page)
  await palette(page).getByRole('combobox').fill(query)
  await palette(page)
    .getByRole('option', { name: new RegExp(name) })
    .click()
}

test('> lists actions under an Actions chip', async ({ context, background }) => {
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Host`)
  await pressOpenAloft(background, page)

  await palette(page).getByRole('combobox').fill('>')
  const group = palette(page).getByRole('group', { name: 'Actions' })
  await expect(group.getByRole('option', { name: /Pin tab/ })).toBeVisible()
  await expect(group.getByRole('option', { name: /Duplicate tab/ })).toBeVisible()
  await expect(palette(page).getByText('Actions', { exact: true }).first()).toBeVisible()
})

test('pins the tab Aloft is open over', async ({ context, background }) => {
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Host`)
  await pressOpenAloft(background, page)
  await runAction(page, '> pin', 'Pin tab')

  await expect.poll(() => isPinned(background, `${TEST_ORIGIN}/Host`)).toBe(true)
  await expect(page.locator('iframe[title="Aloft"]')).toHaveCount(0)
})

test('opens an empty tab next to this one', async ({ context, background }) => {
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Host`)
  await pressOpenAloft(background, page)
  const opened = context.waitForEvent('page')
  await runAction(page, '> new tab', 'New tab')

  await expect(await opened).toHaveURL(/^chrome:\/\/new-?tab|^about:blank/)
  await expect(page.locator('iframe[title="Aloft"]')).toHaveCount(0)
})

test('duplicates the tab', async ({ context, background }) => {
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Host`)
  await pressOpenAloft(background, page)

  const copy = context.waitForEvent('page')
  await runAction(page, '> dup', 'Duplicate tab')
  await expect(await copy).toHaveURL(`${TEST_ORIGIN}/Host`)
})

test('reopens the last closed tab', async ({ context, background }) => {
  const closing = await context.newPage()
  await closing.goto(`${TEST_ORIGIN}/Closed-one`)
  await closing.close()
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Host`)
  await pressOpenAloft(background, page)

  const reopened = context.waitForEvent('page')
  await runAction(page, '> undo', 'Reopen closed tab')
  await expect(await reopened).toHaveURL(`${TEST_ORIGIN}/Closed-one`)
})

test('> becomes a chip that Backspace and Esc turn back into text', async ({
  context,
  background,
}) => {
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Host`)
  await pressOpenAloft(background, page)
  await palettePainted(page)
  const input = palette(page).getByRole('combobox')
  const footer = palette(page).getByRole('contentinfo')

  await page.keyboard.type('>')
  await expect(input).toHaveValue('')
  await expect(input).toHaveAttribute('placeholder', 'Search actions')
  await expect(footer).toContainText('Back')
  await expect(footer).not.toContainText('Actions')

  await page.keyboard.press('Backspace')
  await expect(input).toHaveValue('>')
  await expect(footer).toContainText('Actions')
  await expect(palette(page).getByRole('group', { name: 'Actions' })).toHaveCount(0)

  await page.keyboard.type('pin')
  await expect(input).toHaveValue('pin')
  await page.keyboard.press('Escape')
  await expect(input).toHaveValue('> pin')
  await expect(page.locator('iframe[title="Aloft"]')).toBeVisible()

  await input.fill('> pin')
  await palette(page)
    .getByRole('option', { name: /Pin tab/ })
    .click()
  await expect.poll(() => isPinned(background, `${TEST_ORIGIN}/Host`)).toBe(true)
})

test('says so when no action matches', async ({ context, background }) => {
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Host`)
  await pressOpenAloft(background, page)
  await palette(page).getByRole('combobox').fill('>')
  await palette(page).getByRole('combobox').pressSequentially('zzz')
  await expect(palette(page).getByRole('status')).toHaveText('No matching actions')
})

test("opens the browser's own page beside this one, and switches to it once it's open", async ({
  context,
  background,
}) => {
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Host`)
  await pressOpenAloft(background, page)
  const opened = context.waitForEvent('page')
  await runAction(page, '> extensions', '^Extensions')
  const extensions = await opened
  await expect(extensions).toHaveURL('chrome://extensions/')

  await page.bringToFront()
  await pressOpenAloft(background, page)
  await runAction(page, '> extensions', '^Extensions')
  await expect.poll(() => activeTabUrl(background)).toBe('chrome://extensions/')
  expect(context.pages().filter((p) => p.url() === 'chrome://extensions/')).toHaveLength(1)
})

type Tab = { id?: number; url?: string; windowId: number; mutedInfo?: { muted: boolean } }
type Api = {
  tabs: {
    query: (q: object) => Promise<Tab[]>
    update: (id: number, props: object) => Promise<unknown>
  }
  windows: { create: (props: object) => Promise<{ id?: number }> }
  bookmarks: { search: (q: object) => Promise<unknown[]> }
}

const tabsAt = (background: Worker, url: string) =>
  background.evaluate(async (target) => {
    const api = Reflect.get(globalThis, 'chrome') as Api
    return (await api.tabs.query({})).filter((t) => t.url === target)
  }, url)

const bookmarkCount = (background: Worker, url: string) =>
  background.evaluate(async (target) => {
    const api = Reflect.get(globalThis, 'chrome') as Api
    return (await api.bookmarks.search({ url: target })).length
  }, url)

// Aloft's frame goes with the tab, so Enter is sent the way that doesn't wait
// for an answer from it.
async function runClosingAction(page: Page, query: string, name: string) {
  await palettePainted(page)
  await palette(page).getByRole('combobox').fill(query)
  await expect(palette(page).getByRole('option', { selected: true })).toContainText(name)
  await sendPaletteKey(page, { key: 'Enter' })
}

test('closes the tab', async ({ context, background }) => {
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Host`)
  await pressOpenAloft(background, page)
  await runClosingAction(page, '> close tab', 'Close tab')

  await expect.poll(() => page.isClosed()).toBe(true)
})

test('reloads the tab', async ({ context, background }) => {
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Host`)
  await pressOpenAloft(background, page)
  const reloaded = page.waitForEvent('load')
  await runClosingAction(page, '> reload', 'Reload')

  await reloaded
  await expect(page.locator('iframe[title="Aloft"]')).toHaveCount(0)
})

test('unmutes a muted tab', async ({ context, background }) => {
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Host`)
  const [host] = await tabsAt(background, `${TEST_ORIGIN}/Host`)
  await background.evaluate(async (id) => {
    const api = Reflect.get(globalThis, 'chrome') as Api
    await api.tabs.update(id, { muted: true })
  }, host?.id ?? -1)
  await pressOpenAloft(background, page)
  await palettePainted(page)
  await palette(page).getByRole('combobox').fill('>')
  await expect(palette(page).getByRole('option', { name: /Unmute tab/ })).toBeVisible()
  await expect(palette(page).getByRole('option', { name: /^Mute tab/ })).toHaveCount(0)
  await palette(page)
    .getByRole('option', { name: /Unmute tab/ })
    .click()

  await expect
    .poll(async () => (await tabsAt(background, `${TEST_ORIGIN}/Host`))[0]?.mutedInfo?.muted)
    .toBe(false)
})

test('bookmarks the page, then removes the bookmark', async ({ context, background }) => {
  const url = `${TEST_ORIGIN}/Host`
  const page = await context.newPage()
  await page.goto(url)
  await pressOpenAloft(background, page)
  await runAction(page, '> bookmark this', 'Bookmark this page')
  await expect.poll(() => bookmarkCount(background, url)).toBe(1)

  await pressOpenAloft(background, page)
  await palettePainted(page)
  await palette(page).getByRole('combobox').fill('>')
  await expect(palette(page).getByRole('option', { name: /Remove bookmark/ })).toBeVisible()
  await expect(palette(page).getByRole('option', { name: /Bookmark this page/ })).toHaveCount(0)
  await palette(page)
    .getByRole('option', { name: /Remove bookmark/ })
    .click()
  await expect.poll(() => bookmarkCount(background, url)).toBe(0)
})

test("closes the window's duplicate tabs, keeping this one", async ({ context, background }) => {
  for (const path of ['Copy', 'Copy#part', 'Host#top', 'Other']) {
    const tab = await context.newPage()
    await tab.goto(`${TEST_ORIGIN}/${path}`)
  }
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Host`)
  await pressOpenAloft(background, page)
  await runAction(page, '> duplicates', 'Close duplicate tabs')

  const urls = () =>
    context
      .pages()
      .map((p) => p.url())
      .filter((u) => u.startsWith(TEST_ORIGIN))
      .sort()
  await expect
    .poll(urls)
    .toEqual([`${TEST_ORIGIN}/Copy#part`, `${TEST_ORIGIN}/Host`, `${TEST_ORIGIN}/Other`])
})

test('moves the tab to another window', async ({ context, background }) => {
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Host`)
  const other = await background.evaluate(async (url) => {
    const api = Reflect.get(globalThis, 'chrome') as Api
    return (await api.windows.create({ url, focused: false })).id
  }, `${TEST_ORIGIN}/Elsewhere`)
  await page.bringToFront()
  await pressOpenAloft(background, page)
  await runAction(page, '> move', 'Move tab to the window with Elsewhere \\(1 tab\\)')

  await expect
    .poll(async () => (await tabsAt(background, `${TEST_ORIGIN}/Host`))[0]?.windowId)
    .toBe(other)
})
