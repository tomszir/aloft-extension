import type { Locator, Page, Worker } from '@playwright/test'
import { expect, isPinned, pressOpenAloft, TEST_ORIGIN, tabAction, test } from './fixtures'

// Any tab event (a background tab loading, a title changing) reloads the
// palette's data while it's open. A click whose press and release straddle one
// must still land on the row or menu item it started on.

const palette = (page: Page) => page.locator('iframe[title="Aloft"]').contentFrame()

/** Presses on `target`, pins `url`, and releases once `reloaded` shows the palette caught up. */
async function clickAcrossTabEvent(
  page: Page,
  background: Worker,
  target: Locator,
  url: string,
  reloaded: Locator,
) {
  const box = await target.boundingBox()
  if (!box) throw new Error('target is not visible')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await tabAction(background, url, 'pin')
  await expect(reloaded).toBeVisible()
  await page.mouse.up()
}

test('a result row click survives a tab event mid-press', async ({ context, background }) => {
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Host`)
  await pressOpenAloft(background, page)
  await palette(page).getByRole('combobox').fill('>')

  const copy = context.waitForEvent('page')
  const row = palette(page).getByRole('option', { name: /Duplicate tab/ })
  const unpin = palette(page).getByRole('option', { name: /Unpin tab/ })
  await clickAcrossTabEvent(page, background, row, `${TEST_ORIGIN}/Host`, unpin)
  await expect(await copy).toHaveURL(`${TEST_ORIGIN}/Host`)
})

test('a tile menu click survives a tab event mid-press', async ({ context, background }) => {
  for (const name of ['Mail', 'Other']) {
    const tab = await context.newPage()
    await tab.goto(`${TEST_ORIGIN}/${name}`)
  }
  await tabAction(background, `${TEST_ORIGIN}/Mail`, 'pin')
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Host`)
  await pressOpenAloft(background, page)

  const row = palette(page).getByRole('region', { name: 'Pinned' })
  await row.getByRole('button', { name: 'Mail' }).click({ button: 'right' })
  const unpin = palette(page).getByRole('menuitem', { name: 'Unpin' })
  const otherTile = row.getByRole('button', { name: 'Other' })
  await clickAcrossTabEvent(page, background, unpin, `${TEST_ORIGIN}/Other`, otherTile)
  await expect.poll(() => isPinned(background, `${TEST_ORIGIN}/Mail`)).toBe(false)
})
