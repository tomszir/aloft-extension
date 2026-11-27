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
