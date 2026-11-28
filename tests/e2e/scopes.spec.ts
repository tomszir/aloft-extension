import type { Page, Worker } from '@playwright/test'
import {
  activeTabUrl,
  expect,
  pressOpenAloft,
  sendPaletteKey,
  setSettings,
  TEST_ORIGIN,
  test,
} from './fixtures'

const palette = (page: Page) => page.locator('iframe[title="Aloft"]').contentFrame()

async function addBookmark(background: Worker, title: string, url: string): Promise<void> {
  await background.evaluate(
    async ([title, url]) => {
      const api = Reflect.get(globalThis, 'chrome') as {
        bookmarks: { create: (bookmark: object) => Promise<unknown> }
      }
      await api.bookmarks.create({ title, url })
    },
    [title, url],
  )
}

test('@tabs and Space search only the open tabs, and Enter switches to the top one', async ({
  context,
  background,
}) => {
  const other = await context.newPage()
  await other.goto(`${TEST_ORIGIN}/Alpha%20notes`)
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Beta`)
  await pressOpenAloft(background, page)
  const input = palette(page).getByRole('combobox')

  await input.pressSequentially('@tabs ')
  await expect(input).toHaveValue('')
  await expect(input).toHaveAttribute('placeholder', 'Search open tabs')
  // With nothing typed, the open tabs; never a search row.
  await expect(palette(page).getByRole('option', { name: /Alpha notes/ })).toBeVisible()
  await expect(palette(page).getByText('Search the web')).toHaveCount(0)

  await input.pressSequentially('alpha')
  await expect(palette(page).getByRole('option').first()).toContainText('Alpha notes')
  await expect(palette(page).getByText('Search the web')).toHaveCount(0)
  await sendPaletteKey(page, { key: 'Enter' })

  await expect.poll(() => activeTabUrl(background)).toBe(`${TEST_ORIGIN}/Alpha%20notes`)
})

test('a scope name without @ is a plain search', async ({ context, background }) => {
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Start`)
  await pressOpenAloft(background, page)
  const input = palette(page).getByRole('combobox')

  await input.pressSequentially('tabs vs spaces')
  await expect(input).toHaveValue('tabs vs spaces')
  await expect(input).toHaveAttribute('placeholder', 'Search or enter address')
  await expect(palette(page).getByRole('option').first()).toContainText('Search the web')
})

test('@ lists the scopes above the keywords; picking one makes its chip, Backspace gives it back', async ({
  context,
  background,
}) => {
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Start`)
  await pressOpenAloft(background, page)
  const input = palette(page).getByRole('combobox')

  await input.pressSequentially('@')
  const groups = palette(page).getByRole('group')
  await expect(groups.first()).toHaveAccessibleName('Search only')
  await expect(groups.nth(1)).toHaveAccessibleName('Keywords')

  await input.pressSequentially('hi')
  await expect(palette(page).getByRole('option').first()).toContainText('@history')
  await sendPaletteKey(page, { key: 'Enter' })
  await expect(input).toHaveValue('')
  await expect(input).toHaveAttribute('placeholder', 'Search history')

  await input.press('Backspace')
  await expect(input).toHaveValue('@history')
  await expect(input).toHaveAttribute('placeholder', 'Search or enter address')
})

test('@bookmarks lists the newest bookmarks and opens the top one', async ({
  context,
  background,
}) => {
  await addBookmark(background, 'Older bookmark', `${TEST_ORIGIN}/Older`)
  // Apart in time, so the newer one is newer to the millisecond.
  await new Promise((done) => setTimeout(done, 20))
  await addBookmark(background, 'Newer bookmark', `${TEST_ORIGIN}/Newer`)
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Start`)
  await pressOpenAloft(background, page)
  const input = palette(page).getByRole('combobox')

  await input.pressSequentially('@bookmarks ')
  await expect(input).toHaveAttribute('placeholder', 'Search bookmarks')
  const options = palette(page).getByRole('option')
  await expect(options.first()).toContainText('Newer bookmark')
  await expect(options.nth(1)).toContainText('Older bookmark')

  await input.pressSequentially('older')
  await expect(options).toHaveCount(1)
  const opened = context.waitForEvent('page')
  await sendPaletteKey(page, { key: 'Enter' })
  await expect(await opened).toHaveURL(`${TEST_ORIGIN}/Older`)
})

test('a source switched off in settings has no scope', async ({ context, background }) => {
  await setSettings(background, {
    sources: { tabs: true, history: false, bookmarks: true, recentlyClosed: true },
  })
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Start`)
  await pressOpenAloft(background, page)
  const input = palette(page).getByRole('combobox')

  await input.pressSequentially('@')
  const scopes = palette(page).getByRole('group', { name: 'Search only' })
  await expect(scopes.getByRole('option')).toHaveCount(2)
  await expect(scopes).not.toContainText('History')

  await input.pressSequentially('history ')
  await expect(input).toHaveValue('@history ')
})
