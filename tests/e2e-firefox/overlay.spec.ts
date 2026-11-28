import type { Page } from 'puppeteer-core'
import { activeTabUrl, expect, openPage, paletteFrame, pressOpenAloft, test } from './fixtures'

const overlayShown = (page: Page) =>
  page.evaluate(() => document.querySelector('aloft-overlay') !== null)

test('opens over the page, lists open tabs, and Esc gives focus back', async ({
  firefox,
  control,
  origin,
}) => {
  await openPage(firefox, control, `${origin}/Reading list`)
  const page = await openPage(firefox, control, `${origin}/Notes`)
  await page.focus('#field')

  await pressOpenAloft(control, page)

  const palette = await paletteFrame(page)
  await expect
    .poll(() => palette.evaluate(() => document.activeElement?.getAttribute('role')))
    .toBe('combobox')

  // Open tabs come from the background: the frame has no tabs API in Firefox.
  await page.keyboard.type('reading')
  await expect
    .poll(() => palette.evaluate(() => document.body.textContent ?? ''))
    .toContain('Reading list')

  await page.keyboard.press('Escape')
  await expect.poll(() => overlayShown(page)).toBe(false)
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('field')
})

test('what is typed while it opens goes into the bar, not the page', async ({
  firefox,
  control,
  origin,
}) => {
  const page = await openPage(firefox, control, `${origin}/Notes`)
  await page.focus('#field')

  await pressOpenAloft(control, page)
  // Straight away, while the palette is still loading.
  await page.keyboard.type('reading')

  const palette = await paletteFrame(page)
  await expect
    .poll(() => palette.evaluate(() => document.querySelector('input')?.value))
    .toBe('reading')
  expect(await page.evaluate(() => document.querySelector('input')?.value)).toBe('')
})

test('Enter on an open tab switches to it', async ({ firefox, control, origin }) => {
  const reading = await openPage(firefox, control, `${origin}/Reading list`)
  const page = await openPage(firefox, control, `${origin}/Notes`)

  await pressOpenAloft(control, page)
  const palette = await paletteFrame(page)
  await page.keyboard.type('reading list')
  // A tab whose title starts with the text is the top row.
  await expect
    .poll(() =>
      palette.evaluate(() => document.querySelector('[aria-selected="true"]')?.textContent),
    )
    .toContain('Reading list')
  await page.keyboard.press('Enter')

  await expect.poll(() => activeTabUrl(control)).toBe(reading.url())
  await expect.poll(() => overlayShown(page)).toBe(false)
})

test('opens over a page whose CSP forbids frames', async ({ firefox, control, origin }) => {
  const page = await openPage(firefox, control, `${origin}/strict`)

  await pressOpenAloft(control, page)

  const palette = await paletteFrame(page)
  await expect
    .poll(() => palette.evaluate(() => document.querySelector('[role="combobox"]') !== null))
    .toBe(true)
})

test("shows a tab's icon when it's a data: image, and a letter otherwise", async ({
  firefox,
  control,
  origin,
}) => {
  await openPage(firefox, control, `${origin}/icon-Inbox`)
  await openPage(firefox, control, `${origin}/Inventory`)
  const page = await openPage(firefox, control, `${origin}/Notes`)
  await pressOpenAloft(control, page)
  const palette = await paletteFrame(page)
  await page.keyboard.type('in')

  const rowIcon = (title: string) =>
    palette.evaluate((name) => {
      const row = [...document.querySelectorAll('[role="option"]')].find((option) =>
        option.textContent?.includes(name),
      )
      if (!row) return 'no row'
      return row.querySelector('img')?.getAttribute('src') ?? 'letter'
    }, title)
  // Firefox hands back its own re-encoding of the icon, not the page's bytes.
  await expect.poll(() => rowIcon('icon-Inbox')).toMatch(/^data:image\/png;base64,/)
  await expect.poll(() => rowIcon('Inventory')).toBe('letter')
})
