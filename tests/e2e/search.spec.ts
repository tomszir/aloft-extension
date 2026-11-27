import type { Page } from '@playwright/test'
import { activeTabUrl, expect, pressOpenAloft, sendPaletteKey, TEST_ORIGIN, test } from './fixtures'

const palette = (page: Page) => page.locator('iframe[title="Aloft"]').contentFrame()

test('finds an open tab by title and switches to it', async ({ context, background }) => {
  const other = await context.newPage()
  await other.goto(`${TEST_ORIGIN}/Alpha%20notes`)
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Beta`)
  await pressOpenAloft(background, page)

  await palette(page).getByRole('combobox').fill('alpha')
  const tabs = palette(page).getByRole('group', { name: 'Open tabs' })
  await expect(tabs.getByRole('option', { name: /Alpha notes/ })).toBeVisible()

  await page.keyboard.press('ArrowDown')
  await sendPaletteKey(page, { key: 'Enter' })

  await expect.poll(() => activeTabUrl(background)).toBe(`${TEST_ORIGIN}/Alpha%20notes`)
  await expect(page.locator('iframe[title="Aloft"]')).toHaveCount(0)
})

test('an address opens in a new tab with Enter', async ({ context, background }) => {
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Start`)
  await pressOpenAloft(background, page)

  await palette(page).getByRole('combobox').fill('aloft.test/Opened')
  await expect(palette(page).getByRole('option').first()).toContainText('aloft.test/Opened')

  const opened = context.waitForEvent('page')
  await sendPaletteKey(page, { key: 'Enter' })
  await expect(await opened).toHaveURL(`${TEST_ORIGIN}/Opened`)
  await expect(page).toHaveURL(`${TEST_ORIGIN}/Start`)
  await expect(page.locator('iframe[title="Aloft"]')).toHaveCount(0)
})

test('Shift+Enter opens in the current tab instead', async ({ context, background }) => {
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Start`)
  await pressOpenAloft(background, page)

  await palette(page).getByRole('combobox').fill('aloft.test/Here')
  await expect(palette(page).getByRole('option').first()).toContainText('aloft.test/Here')
  await sendPaletteKey(page, { key: 'Enter', shiftKey: true })

  await expect(page).toHaveURL(`${TEST_ORIGIN}/Here`)
})

test('typed script URLs are searched for, never opened', async ({ context, background }) => {
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Start`)
  await pressOpenAloft(background, page)

  await palette(page).getByRole('combobox').fill('javascript:alert(1)')
  const options = palette(page).getByRole('option')
  await expect(options).toHaveCount(1)
  await expect(options.first()).toContainText('Search the web')
})

test('a page the browser has no icon for gets a letter tile', async ({ context, background }) => {
  const other = await context.newPage()
  await other.goto(`${TEST_ORIGIN}/Gamma%20notes`)
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Start`)
  await pressOpenAloft(background, page)

  await palette(page).getByRole('combobox').fill('gamma')
  const row = palette(page).getByRole('option', { name: /Gamma notes/ })
  await expect(row.getByTestId('favicon-letter')).toHaveText('G')
  await expect(row.locator('img')).toHaveCount(0)
  await expect(row.locator('mark')).toHaveText('Gamma')
})

test('a tab picked twice for the same initials becomes what Enter opens', async ({
  context,
  background,
}) => {
  const rules = await context.newPage()
  await rules.goto(`${TEST_ORIGIN}/Window%20Rules`)
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Start`)

  for (let i = 0; i < 2; i++) {
    await pressOpenAloft(background, page)
    await palette(page).getByRole('combobox').fill('wr')
    const tabs = palette(page).getByRole('group', { name: 'Open tabs' })
    await expect(tabs.getByRole('option', { name: /Window Rules/ })).toBeVisible()
    await page.keyboard.press('ArrowDown')
    await sendPaletteKey(page, { key: 'Enter' })
    await expect.poll(() => activeTabUrl(background)).toBe(`${TEST_ORIGIN}/Window%20Rules`)
  }

  await pressOpenAloft(background, page)
  await palette(page).getByRole('combobox').fill('wr')
  await expect(palette(page).getByRole('option').first()).toContainText('Window Rules')
  await sendPaletteKey(page, { key: 'Enter' })
  await expect.poll(() => activeTabUrl(background)).toBe(`${TEST_ORIGIN}/Window%20Rules`)
})

test('Delete closes the selected open tab and selects the next one', async ({
  context,
  background,
}) => {
  const first = await context.newPage()
  await first.goto(`${TEST_ORIGIN}/My%20draft%20one`)
  const second = await context.newPage()
  await second.goto(`${TEST_ORIGIN}/My%20draft%20two`)
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Start`)
  await pressOpenAloft(background, page)

  const input = palette(page).getByRole('combobox')
  await input.fill('draft')
  const tabs = palette(page).getByRole('group', { name: 'Open tabs' })
  await expect(tabs.getByRole('option')).toHaveCount(2)
  await page.keyboard.press('ArrowDown')
  const selected = palette(page).locator('[aria-selected="true"]')
  const closing = (await selected.textContent())?.includes('draft one') ? first : second
  await page.keyboard.press('Delete')

  await expect.poll(() => closing.isClosed()).toBe(true)
  await expect(tabs.getByRole('option')).toHaveCount(1)
  // Aloft stays open, on the row that took its place.
  await expect(input).toBeFocused()
  await expect(selected).toContainText('draft')
})
