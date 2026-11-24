import type { Page } from '@playwright/test'
import { expect, pressOpenAloft, sendPaletteKey, setKeywords, TEST_ORIGIN, test } from './fixtures'

const palette = (page: Page) => page.locator('iframe[title="Aloft"]').contentFrame()

// A keyword of the user's own on the test origin, so nothing reaches a real site.
const testKeyword = {
  id: 'custom-test',
  name: 'Test Search',
  keyword: 'ts',
  url: `${TEST_ORIGIN}/Results?q=%s`,
  enabled: true,
}

async function openAloft(background: Parameters<typeof pressOpenAloft>[0], page: Page) {
  await setKeywords(background, { builtIn: {}, custom: [testKeyword] })
  await page.goto(`${TEST_ORIGIN}/Start`)
  await pressOpenAloft(background, page)
}

test('a keyword and Space search that site', async ({ context, background }) => {
  const page = await context.newPage()
  await openAloft(background, page)
  const input = palette(page).getByRole('combobox')

  await input.pressSequentially('ts lofi beats')
  await expect(input).toHaveValue('lofi beats')
  await expect(input).toHaveAttribute('placeholder', 'Search Test Search')
  await expect(palette(page).getByRole('option').first()).toContainText('lofi beats')

  const opened = context.waitForEvent('page')
  await sendPaletteKey(page, { key: 'Enter' })
  await expect(await opened).toHaveURL(`${TEST_ORIGIN}/Results?q=lofi%20beats`)
})

test('Tab enters an offered keyword, and Backspace gives it back', async ({
  context,
  background,
}) => {
  const page = await context.newPage()
  await openAloft(background, page)
  const input = palette(page).getByRole('combobox')

  await input.pressSequentially('@ts')
  await expect(palette(page).getByRole('option').first()).toContainText('Search Test Search')
  await input.press('Tab')
  await expect(input).toHaveValue('')
  await expect(input).toBeFocused()

  await input.press('Backspace')
  await expect(input).toHaveValue('ts')
})

test('@ lists the keywords, and picking one makes its chip', async ({ context, background }) => {
  const page = await context.newPage()
  await openAloft(background, page)
  const input = palette(page).getByRole('combobox')
  const list = palette(page).getByRole('group', { name: 'Keywords' })

  await input.pressSequentially('@')
  await expect(list.getByRole('option', { name: /Search Test Search/ })).toBeVisible()
  await expect(list.getByRole('option', { name: /Search YouTube/ })).toBeVisible()

  await input.pressSequentially('test')
  await expect(list.getByRole('option')).toHaveCount(1)
  await expect(list.getByRole('option')).toContainText('ts, then Space')

  await sendPaletteKey(page, { key: 'Enter' })
  await expect(input).toHaveValue('')
  await expect(input).toHaveAttribute('placeholder', 'Search Test Search')
})

test('a switched-off keyword is plain text', async ({ context, background }) => {
  const page = await context.newPage()
  await setKeywords(background, { builtIn: {}, custom: [{ ...testKeyword, enabled: false }] })
  await page.goto(`${TEST_ORIGIN}/Start`)
  await pressOpenAloft(background, page)
  const input = palette(page).getByRole('combobox')
  await input.pressSequentially('ts cats')
  await expect(input).toHaveValue('ts cats')
})

test('a keyword added in settings works in Aloft', async ({ context, background }) => {
  const settings = await context.newPage()
  await settings.goto(new URL('/options.html', background.url()).href)
  const card = settings.getByRole('region', { name: 'Keywords' })
  await card.getByRole('button', { name: 'Add keyword' }).click()
  const form = card.getByRole('form', { name: 'Add keyword' })
  await form.getByLabel('Name').fill('Test Search')
  await form.getByLabel('Keyword').fill('ts')
  await form.getByLabel(/Address/).fill(`${TEST_ORIGIN}/Results?q=%s`)
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(card.getByRole('button', { name: 'Edit Test Search' })).toBeVisible()

  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Start`)
  await pressOpenAloft(background, page)
  const input = palette(page).getByRole('combobox')
  await input.pressSequentially('ts cats')
  const opened = context.waitForEvent('page')
  await sendPaletteKey(page, { key: 'Enter' })
  await expect(await opened).toHaveURL(`${TEST_ORIGIN}/Results?q=cats`)
})
