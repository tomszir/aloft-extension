import type { Page } from '@playwright/test'
import { activeTabUrl, expect, pressOpenAloft, TEST_ORIGIN, test } from './fixtures'

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
  await page.keyboard.press('Enter')

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
  await page.keyboard.press('Enter')
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
  await page.keyboard.press('Shift+Enter')

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
