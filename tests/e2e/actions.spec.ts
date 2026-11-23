import type { Page } from '@playwright/test'
import { expect, isPinned, pressOpenAloft, TEST_ORIGIN, test } from './fixtures'

const palette = (page: Page) => page.locator('iframe[title="Aloft"]').contentFrame()

async function runAction(page: Page, query: string, name: string) {
  await palette(page).getByRole('combobox').fill(query)
  await palette(page)
    .getByRole('option', { name: new RegExp(name) })
    .click()
}

test('> lists actions under an Actions chip', async ({ context, background }) => {
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Host`)
  await pressOpenAloft(background, page)

  await palette(page).getByRole('combobox').fill('>')
  const group = palette(page).getByRole('group', { name: 'Actions' })
  await expect(group.getByRole('option', { name: /Pin tab/ })).toBeVisible()
  await expect(group.getByRole('option', { name: /Duplicate tab/ })).toBeVisible()
  await expect(palette(page).getByText('Actions', { exact: true }).first()).toBeVisible()
})

test('pins the tab Aloft is open over', async ({ context, background }) => {
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Host`)
  await pressOpenAloft(background, page)
  await runAction(page, '> pin', 'Pin tab')

  await expect.poll(() => isPinned(background, `${TEST_ORIGIN}/Host`)).toBe(true)
  await expect(page.locator('iframe[title="Aloft"]')).toHaveCount(0)
})

test('duplicates the tab', async ({ context, background }) => {
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Host`)
  await pressOpenAloft(background, page)

  const copy = context.waitForEvent('page')
  await runAction(page, '> dup', 'Duplicate tab')
  await expect(await copy).toHaveURL(`${TEST_ORIGIN}/Host`)
})

test('reopens the last closed tab', async ({ context, background }) => {
  const closing = await context.newPage()
  await closing.goto(`${TEST_ORIGIN}/Closed-one`)
  await closing.close()
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Host`)
  await pressOpenAloft(background, page)

  const reopened = context.waitForEvent('page')
  await runAction(page, '> undo', 'Reopen closed tab')
  await expect(await reopened).toHaveURL(`${TEST_ORIGIN}/Closed-one`)
})
