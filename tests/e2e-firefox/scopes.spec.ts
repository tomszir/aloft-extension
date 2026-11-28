import type { Page } from 'puppeteer-core'
import {
  activeTabUrl,
  expect,
  openPage,
  paletteFrame,
  paletteText,
  pressOpenAloft,
  selectedRow,
  tabUrls,
  test,
} from './fixtures'

// Scopes read tabs and bookmarks through the background in Firefox, like the
// rest of the palette's searches.

// Neither keyboard.type('@') nor sendCharacter reach the input in Firefox;
// the key itself, as a US layout types it, does.
async function typeAt(page: Page): Promise<void> {
  await page.keyboard.down('Shift')
  await page.keyboard.press('Digit2')
  await page.keyboard.up('Shift')
}

const placeholder = (page: Page) =>
  paletteFrame(page).then((palette) =>
    palette.evaluate(() => document.querySelector('input')?.placeholder),
  )

test('@tabs and Space search only the open tabs', async ({ firefox, control, origin }) => {
  await openPage(firefox, control, `${origin}/Alpha%20notes`)
  const page = await openPage(firefox, control, `${origin}/Beta`)
  await pressOpenAloft(control, page)
  const palette = await paletteFrame(page)

  await typeAt(page)
  await expect.poll(() => paletteText(palette)).toContain('Search only')
  await page.keyboard.type('tabs alpha')
  await expect.poll(() => placeholder(page)).toBe('Search open tabs')
  await expect.poll(() => selectedRow(palette)).toContain('Alpha notes')
  expect(await paletteText(palette)).not.toContain('Search the web')
  await page.keyboard.press('Enter')

  await expect.poll(() => activeTabUrl(control)).toBe(`${origin}/Alpha%20notes`)
})

test('a scope name without @ is a plain search', async ({ firefox, control, origin }) => {
  const page = await openPage(firefox, control, `${origin}/Start`)
  await pressOpenAloft(control, page)
  const palette = await paletteFrame(page)

  await page.keyboard.type('history of rome')
  await expect.poll(() => selectedRow(palette)).toContain('Search the web')
  expect(await placeholder(page)).toBe('Search or enter address')
})

test('@bookmarks finds a bookmark and opens it', async ({ firefox, control, origin }) => {
  await control.evaluate(async (url) => {
    const api = Reflect.get(globalThis, 'browser') as {
      bookmarks: { create: (bookmark: object) => Promise<unknown> }
    }
    await api.bookmarks.create({ title: 'Saved page', url })
  }, `${origin}/Saved`)
  const page = await openPage(firefox, control, `${origin}/Start`)
  await pressOpenAloft(control, page)
  const palette = await paletteFrame(page)

  await typeAt(page)
  await page.keyboard.type('bookmarks ')
  await expect.poll(() => placeholder(page)).toBe('Search bookmarks')
  await expect.poll(() => selectedRow(palette)).toContain('Saved page')
  await page.keyboard.press('Enter')

  await expect.poll(() => tabUrls(control)).toContain(`${origin}/Saved`)
})
