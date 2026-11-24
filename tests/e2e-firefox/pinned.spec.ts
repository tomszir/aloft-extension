import type { Browser, Frame, Page } from 'puppeteer-core'
import {
  activeTabUrl,
  expect,
  isPinned,
  openPage,
  paletteFrame,
  pressOpenAloft,
  setPinned,
  test,
} from './fixtures'

// The row is a <section> named by its label, a region only implicitly; each
// tile is a button named by its page's title.
const TILES = 'section[aria-labelledby="al-pinned-label"] button[aria-label]'

async function withPins(firefox: Browser, control: Page, origin: string, names: string[]) {
  for (const name of names) {
    const tab = await openPage(firefox, control, `${origin}/${name}`)
    await setPinned(control, tab.url(), true)
  }
  const page = await openPage(firefox, control, `${origin}/Host`)
  await pressOpenAloft(control, page)
  return { page, palette: await paletteFrame(page) }
}

const tileNames = (palette: Frame) =>
  palette.evaluate(
    (selector) =>
      [...document.querySelectorAll(selector)].map((tile) => tile.getAttribute('aria-label')),
    TILES,
  )

/** Runs `action` on the tile for `name`, inside the palette. */
function onTile(palette: Frame, name: string, action: 'contextmenu') {
  return palette.evaluate(
    (selector, title, type) => {
      const tile = [...document.querySelectorAll(selector)].find(
        (t) => t.getAttribute('aria-label') === title,
      )
      if (!tile) throw new Error(`no tile for ${title}`)
      tile.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }))
    },
    TILES,
    name,
    action,
  )
}

test('shows pinned tabs as a row and opens one with Alt+digit', async ({
  firefox,
  control,
  origin,
}) => {
  const { page, palette } = await withPins(firefox, control, origin, ['Mail', 'Calendar'])
  await expect.poll(() => tileNames(palette)).toEqual(['Mail', 'Calendar'])

  await page.keyboard.down('Alt')
  await page.keyboard.press('2')
  await page.keyboard.up('Alt')

  await expect.poll(() => activeTabUrl(control)).toBe(`${origin}/Calendar`)
})

test('unpins from the tile menu and the row updates', async ({ firefox, control, origin }) => {
  const { palette } = await withPins(firefox, control, origin, ['Mail', 'Calendar'])
  await expect.poll(() => tileNames(palette)).toEqual(['Mail', 'Calendar'])

  await onTile(palette, 'Mail', 'contextmenu')
  await palette.evaluate(() => {
    const unpin = [...document.querySelectorAll('[role="menuitem"]')].find(
      (item) => item.textContent?.trim() === 'Unpin',
    )
    if (!(unpin instanceof HTMLElement)) throw new Error('no Unpin item')
    unpin.click()
  })

  // The row only hears about the unpin over the background's tab-event port.
  await expect.poll(() => tileNames(palette)).toEqual(['Calendar'])
  expect(await isPinned(control, `${origin}/Mail`)).toBe(false)
})
