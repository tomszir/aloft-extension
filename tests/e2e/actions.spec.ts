import type { Page } from '@playwright/test'
import {
  activeTabUrl,
  expect,
  isPinned,
  palettePainted,
  pressOpenAloft,
  TEST_ORIGIN,
  test,
} from './fixtures'

const palette = (page: Page) => page.locator('iframe[title="Aloft"]').contentFrame()

async function runAction(page: Page, query: string, name: string) {
  await palettePainted(page)
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

test('opens an empty tab next to this one', async ({ context, background }) => {
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Host`)
  await pressOpenAloft(background, page)
  const opened = context.waitForEvent('page')
  await runAction(page, '> new tab', 'New tab')

  await expect(await opened).toHaveURL(/^chrome:\/\/new-?tab|^about:blank/)
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

test('> becomes a chip that Backspace and Esc turn back into text', async ({
  context,
  background,
}) => {
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Host`)
  await pressOpenAloft(background, page)
  await palettePainted(page)
  const input = palette(page).getByRole('combobox')
  const footer = palette(page).getByRole('contentinfo')

  await page.keyboard.type('>')
  await expect(input).toHaveValue('')
  await expect(input).toHaveAttribute('placeholder', 'Search actions')
  await expect(footer).toContainText('Back')
  await expect(footer).not.toContainText('Actions')

  await page.keyboard.press('Backspace')
  await expect(input).toHaveValue('>')
  await expect(footer).toContainText('Actions')
  await expect(palette(page).getByRole('group', { name: 'Actions' })).toHaveCount(0)

  await page.keyboard.type('pin')
  await expect(input).toHaveValue('pin')
  await page.keyboard.press('Escape')
  await expect(input).toHaveValue('> pin')
  await expect(page.locator('iframe[title="Aloft"]')).toBeVisible()

  await input.fill('> pin')
  await palette(page)
    .getByRole('option', { name: /Pin tab/ })
    .click()
  await expect.poll(() => isPinned(background, `${TEST_ORIGIN}/Host`)).toBe(true)
})

test('says so when no action matches', async ({ context, background }) => {
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Host`)
  await pressOpenAloft(background, page)
  await palette(page).getByRole('combobox').fill('>')
  await palette(page).getByRole('combobox').pressSequentially('zzz')
  await expect(palette(page).getByRole('status')).toHaveText('No matching actions')
})

test("opens the browser's own page beside this one, and switches to it once it's open", async ({
  context,
  background,
}) => {
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Host`)
  await pressOpenAloft(background, page)
  const opened = context.waitForEvent('page')
  await runAction(page, '> extensions', '^Extensions')
  const extensions = await opened
  await expect(extensions).toHaveURL('chrome://extensions/')

  await page.bringToFront()
  await pressOpenAloft(background, page)
  await runAction(page, '> extensions', '^Extensions')
  await expect.poll(() => activeTabUrl(background)).toBe('chrome://extensions/')
  expect(context.pages().filter((p) => p.url() === 'chrome://extensions/')).toHaveLength(1)
})
