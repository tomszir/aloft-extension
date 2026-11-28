import type { Page } from '@playwright/test'
import {
  expect,
  isPinned,
  palettePainted,
  pressOpenAloft,
  sendPaletteKey,
  TEST_ORIGIN,
  test,
} from './fixtures'

const palette = (page: Page) => page.locator('iframe[title="Aloft"]').contentFrame()

async function pasteInto(page: Page): Promise<string> {
  await page.bringToFront()
  await page.locator('#field').focus()
  await page.keyboard.press('Control+v')
  return page.locator('#field').inputValue()
}

test("copies an open tab's address from its menu", async ({ context, background }) => {
  const other = await context.newPage()
  await other.goto(`${TEST_ORIGIN}/Other`)
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Host`)
  await pressOpenAloft(background, page)
  await palettePainted(page)
  await expect(palette(page).getByRole('option', { selected: true })).toContainText('Other')
  await expect(palette(page).getByRole('contentinfo')).toContainText('Ctrl+K')
  await page.keyboard.press('Control+k')
  await palette(page).getByRole('menuitem', { name: 'Copy address' }).click()

  await expect(page.locator('iframe[title="Aloft"]')).toHaveCount(0)
  await expect.poll(() => pasteInto(page)).toBe(`${TEST_ORIGIN}/Other`)
})

test('copies an address from the palette in a tab of its own', async ({ context, background }) => {
  const reading = await context.newPage()
  await reading.goto(`${TEST_ORIGIN}/Reading`)
  const page = await context.newPage()
  await page.goto('chrome://version')
  const opened = context.waitForEvent('page')
  await pressOpenAloft(background, page)
  const paletteTab = await opened
  await paletteTab.getByRole('option', { name: /Reading/ }).hover()
  await expect(paletteTab.getByRole('option', { selected: true })).toContainText('Reading')
  await paletteTab.keyboard.press('Control+k')
  await paletteTab
    .getByRole('menuitem', { name: 'Copy address' })
    .click()
    .catch((error: unknown) => {
      // Copying closes the tab, which can happen before the click returns.
      if (!paletteTab.isClosed()) throw error
    })

  await expect.poll(() => paletteTab.isClosed()).toBe(true)
  await expect.poll(() => pasteInto(reading)).toBe(`${TEST_ORIGIN}/Reading`)
})

test('a right click opens the menu, and Esc closes only the menu', async ({
  context,
  background,
}) => {
  const other = await context.newPage()
  await other.goto(`${TEST_ORIGIN}/Other`)
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Host`)
  await pressOpenAloft(background, page)
  await palettePainted(page)
  await palette(page).getByRole('option', { name: /Other/ }).click({ button: 'right' })
  await expect(palette(page).getByRole('menuitem', { name: 'Switch to tab' })).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(palette(page).getByRole('menu')).toHaveCount(0)
  await expect(palette(page).getByRole('combobox')).toBeFocused()
})

test('pins another tab from its menu and stays open', async ({ context, background }) => {
  const other = await context.newPage()
  await other.goto(`${TEST_ORIGIN}/Other`)
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Host`)
  await pressOpenAloft(background, page)
  await palettePainted(page)
  await page.keyboard.press('Control+k')
  await palette(page).getByRole('menuitem', { name: 'Pin tab' }).click()

  await expect.poll(() => isPinned(background, `${TEST_ORIGIN}/Other`)).toBe(true)
  await expect(palette(page).getByRole('combobox')).toBeFocused()
})

test('removes a page from history', async ({ context, background }) => {
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Forgettable`)
  await page.goto(`${TEST_ORIGIN}/Host`)
  const visits = () =>
    background.evaluate(async () => {
      const api = Reflect.get(globalThis, 'chrome') as {
        history: { search: (q: object) => Promise<{ url?: string }[]> }
      }
      const items = await api.history.search({ text: 'Forgettable', startTime: 0 })
      return items.length
    })
  await expect.poll(visits).toBe(1)
  await pressOpenAloft(background, page)
  await palettePainted(page)
  await palette(page).getByRole('combobox').fill('Forgettable')
  const row = palette(page)
    .getByRole('group', { name: 'History' })
    .getByRole('option', { name: /Forgettable/ })
  await row.hover()
  await page.keyboard.press('Control+k')
  await palette(page).getByRole('menuitem', { name: 'Remove from history' }).click()

  await expect(row).toHaveCount(0)
  await expect.poll(visits).toBe(0)
  await sendPaletteKey(page, { key: 'Escape' })
})
