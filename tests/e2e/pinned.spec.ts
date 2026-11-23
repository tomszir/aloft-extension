import type { BrowserContext, Page, Worker } from '@playwright/test'
import {
  activeTabUrl,
  expect,
  isPinned,
  pressOpenAloft,
  sendPaletteKey,
  TEST_ORIGIN,
  tabAction,
  test,
} from './fixtures'

const palette = (page: Page) => page.locator('iframe[title="Aloft"]').contentFrame()

async function withPins(context: BrowserContext, background: Worker, names: string[]) {
  for (const name of names) {
    const tab = await context.newPage()
    await tab.goto(`${TEST_ORIGIN}/${name}`)
    await tabAction(background, `${TEST_ORIGIN}/${name}`, 'pin')
  }
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Host`)
  await pressOpenAloft(background, page)
  return page
}

test('shows pinned tabs as a row and opens one with Alt+digit', async ({ context, background }) => {
  const page = await withPins(context, background, ['Mail', 'Calendar'])
  const row = palette(page).getByRole('region', { name: 'Pinned' })
  await expect(row.getByRole('button', { name: 'Mail' })).toBeVisible()
  await expect(row.getByRole('button', { name: 'Calendar' })).toHaveAttribute(
    'aria-keyshortcuts',
    'Alt+2',
  )
  // Pins have their own row, so the open-tabs list doesn't repeat them.
  await expect(palette(page).getByRole('option', { name: /Mail/ })).toHaveCount(0)

  await sendPaletteKey(page, { key: '2', code: 'Digit2', altKey: true })
  await expect.poll(() => activeTabUrl(background)).toBe(`${TEST_ORIGIN}/Calendar`)
  await expect(page.locator('iframe[title="Aloft"]')).toHaveCount(0)
})

test('hides the row while typing, but still finds pins', async ({ context, background }) => {
  const page = await withPins(context, background, ['Mail'])
  await palette(page).getByRole('combobox').fill('mail')
  await expect(palette(page).getByRole('region', { name: 'Pinned' })).toHaveCount(0)
  await expect(palette(page).getByRole('option', { name: /Mail/ })).toBeVisible()
})

test('unpins from the tile menu and the row updates', async ({ context, background }) => {
  const page = await withPins(context, background, ['Mail', 'Calendar'])
  const row = palette(page).getByRole('region', { name: 'Pinned' })
  await row.getByRole('button', { name: 'Mail' }).click({ button: 'right' })
  await palette(page).getByRole('menuitem', { name: 'Unpin' }).click()

  await expect(row.getByRole('button', { name: 'Mail' })).toHaveCount(0)
  await expect(row.getByRole('button', { name: 'Calendar' })).toBeVisible()
  expect(await isPinned(background, `${TEST_ORIGIN}/Mail`)).toBe(false)
})

test('marks only loaded pins, not sleeping ones', async ({ context, background }) => {
  test.skip(
    !/helium/.test(process.env.ALOFT_BROWSER ?? ''),
    'tabs.discard takes down headless Chromium; checked against Helium only',
  )
  const page = await withPins(context, background, ['Mail', 'Calendar'])
  const row = palette(page).getByRole('region', { name: 'Pinned' })
  await expect(row.getByRole('button', { name: 'Mail' })).toHaveAttribute('data-loaded', 'true')

  await tabAction(background, `${TEST_ORIGIN}/Calendar`, 'discard')
  await expect(row.getByRole('button', { name: 'Calendar' })).not.toHaveAttribute(
    'data-loaded',
    'true',
  )
})
