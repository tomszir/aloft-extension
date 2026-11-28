import type { Frame, Page } from 'puppeteer-core'
import {
  EXTENSION_ORIGIN,
  expect,
  isPinned,
  openPage,
  paletteFrame,
  pressOpenAloft,
  selectedRow,
  tabUrls,
  test,
} from './fixtures'

const focusedRole = (palette: Frame | Page) =>
  palette.evaluate(() => document.activeElement?.getAttribute('role'))
const focusedText = (palette: Frame | Page) =>
  palette.evaluate(() => document.activeElement?.textContent)

async function openMenu(page: Page, palette: Frame | Page): Promise<void> {
  await page.keyboard.down('Control')
  await page.keyboard.press('k')
  await page.keyboard.up('Control')
  await expect.poll(() => focusedRole(palette)).toBe('menuitem')
}

// Close tab is last; Copy address is just above it.
async function copyFromMenu(page: Page, palette: Frame | Page): Promise<void> {
  await openMenu(page, palette)
  await page.keyboard.press('End')
  await page.keyboard.press('ArrowUp')
  await expect.poll(() => focusedText(palette)).toBe('Copy address')
  await page.keyboard.press('Enter')
}

async function pasted(page: Page): Promise<string> {
  await page.bringToFront()
  await page.focus('#field')
  await page.$eval('#field', (field) => {
    ;(field as HTMLInputElement).value = ''
  })
  await page.keyboard.down('Control')
  await page.keyboard.press('v')
  await page.keyboard.up('Control')
  return page.$eval('#field', (field) => (field as HTMLInputElement).value)
}

test("copies an open tab's address from its menu", async ({ firefox, control, origin }) => {
  await openPage(firefox, control, `${origin}/Other`)
  const page = await openPage(firefox, control, `${origin}/Host`)
  await pressOpenAloft(control, page)
  const palette = await paletteFrame(page)
  await expect.poll(() => selectedRow(palette)).toContain('Other')

  await copyFromMenu(page, palette)

  await expect.poll(() => page.$('aloft-overlay').then(Boolean)).toBe(false)
  await expect.poll(() => pasted(page)).toBe(`${origin}/Other`)
})

test('copies an address from the palette in a tab of its own', async ({
  firefox,
  control,
  origin,
}) => {
  const reading = await openPage(firefox, control, `${origin}/Reading`)
  // The page Aloft opens as a tab of its own where it can't draw over the
  // page, opened the way the control page is: extension pages never report
  // finishing loading over BiDi.
  const tab = await firefox.newPage()
  void tab.goto(`${EXTENSION_ORIGIN}/palette.html?host=tab`).catch(() => {})
  await expect.poll(() => focusedRole(tab)).toBe('combobox')
  await expect
    .poll(() => tab.evaluate(() => document.querySelector('[aria-selected="true"]')?.textContent))
    .toContain('Reading')

  await copyFromMenu(tab, tab)

  await expect
    .poll(async () => (await tabUrls(control)).some((url) => url.includes('/palette.html')))
    .toBe(false)
  await expect.poll(() => pasted(reading)).toBe(`${origin}/Reading`)
})

test('Esc closes only the menu; Pin tab pins the row and keeps Aloft open', async ({
  firefox,
  control,
  origin,
}) => {
  await openPage(firefox, control, `${origin}/Other`)
  const page = await openPage(firefox, control, `${origin}/Host`)
  await pressOpenAloft(control, page)
  const palette = await paletteFrame(page)
  await expect.poll(() => selectedRow(palette)).toContain('Other')

  await openMenu(page, palette)
  await page.keyboard.press('Escape')
  await expect.poll(() => focusedRole(palette)).toBe('combobox')

  await openMenu(page, palette)
  while ((await focusedText(palette)) !== 'Pin tab') await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')

  await expect.poll(() => isPinned(control, `${origin}/Other`)).toBe(true)
  await expect.poll(() => focusedRole(palette)).toBe('combobox')
})
