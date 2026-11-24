import type { BrowserContext, Locator, Page, Worker } from '@playwright/test'
import {
  activeTabUrl,
  expect,
  isPinned,
  palettePainted,
  pinnedUrls,
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
  await palettePainted(page)
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

test('marks only sleeping pins', async ({ context, background }) => {
  test.skip(
    !/helium/.test(process.env.ALOFT_BROWSER ?? ''),
    'tabs.discard takes down headless Chromium; checked against Helium only',
  )
  const page = await withPins(context, background, ['Mail', 'Calendar'])
  const row = palette(page).getByRole('region', { name: 'Pinned' })
  await expect(row.getByRole('button', { name: 'Calendar' })).not.toHaveAttribute('data-asleep')

  await tabAction(background, `${TEST_ORIGIN}/Calendar`, 'discard')
  await expect(row.getByRole('button', { name: 'Calendar' })).toHaveAttribute('data-asleep', 'true')
  await expect(row.getByRole('button', { name: 'Mail' })).not.toHaveAttribute('data-asleep')
})

const tileNames = (row: Locator) =>
  row.getByRole('button').evaluateAll((tiles) => tiles.map((t) => t.getAttribute('aria-label')))

// Measured once Aloft's open animation has finished and the row has every
// pin: on slow runners a press could land while the panel was still scaling
// in, or before the last pin's tab event, and the drag never started.
async function dragTile(page: Page, from: string, to: string) {
  const row = palette(page).getByRole('region', { name: 'Pinned' })
  await row.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)))
  await expect(row.getByRole('button', { name: to })).toBeVisible()
  const source = await row.getByRole('button', { name: from }).boundingBox()
  const target = await row.getByRole('button', { name: to }).boundingBox()
  if (!source || !target) throw new Error('tile not on screen')
  const y = source.y + 20
  await page.mouse.move(source.x + source.width / 2, y)
  await page.mouse.down()
  await page.mouse.move(source.x + source.width / 2 + 10, y, { steps: 2 })
  await expect(row.getByRole('button', { name: from })).toHaveAttribute('data-lifted', 'true')
  await page.mouse.move(target.x + target.width / 2, y, { steps: 12 })
  return row
}

test('drags a pin to a new place in the row and the tabs follow', async ({
  context,
  background,
}) => {
  const page = await withPins(context, background, ['Mail', 'Calendar', 'Music'])
  const row = await dragTile(page, 'Mail', 'Music')
  await page.mouse.up()

  await expect.poll(() => tileNames(row)).toEqual(['Calendar', 'Music', 'Mail'])
  await expect
    .poll(() => pinnedUrls(background))
    .toEqual(['Calendar', 'Music', 'Mail'].map((name) => `${TEST_ORIGIN}/${name}`))
  // Dropping isn't a click: the palette stays open on the page.
  await expect(page.locator('iframe[title="Aloft"]')).toHaveCount(1)
})

test('Esc puts a dragged pin back and keeps Aloft open', async ({ context, background }) => {
  const page = await withPins(context, background, ['Mail', 'Calendar', 'Music'])
  const row = await dragTile(page, 'Mail', 'Music')
  await page.keyboard.press('Escape')
  await page.mouse.up()

  await expect.poll(() => tileNames(row)).toEqual(['Mail', 'Calendar', 'Music'])
  await expect(page.locator('iframe[title="Aloft"]')).toHaveCount(1)
  expect(await pinnedUrls(background)).toEqual(
    ['Mail', 'Calendar', 'Music'].map((name) => `${TEST_ORIGIN}/${name}`),
  )
})
