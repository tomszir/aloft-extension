import type { Page, Worker } from '@playwright/test'
import { expect, palettePainted, pressOpenAloft, TEST_ORIGIN, test } from './fixtures'

const palette = (page: Page) => page.locator('iframe[title="Aloft"]').contentFrame()
const preview = (page: Page) => page.locator('iframe[title="Preview"]').contentFrame()

async function openSettings(page: Page, background: Worker) {
  await page.goto(new URL('/options.html', background.url()).href)
}

async function storedSettings(background: Worker): Promise<unknown> {
  return background.evaluate(async () => {
    const api = Reflect.get(globalThis, 'chrome') as {
      storage: { sync: { get: (key: string) => Promise<Record<string, unknown>> } }
    }
    return (await api.storage.sync.get('settings')).settings
  })
}

test('> open settings opens the settings page', async ({ context, background }) => {
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Host`)
  await pressOpenAloft(background, page)
  await palettePainted(page)

  const opened = context.waitForEvent('page')
  await palette(page).getByRole('combobox').fill('> settings')
  await palette(page)
    .getByRole('option', { name: /Open settings/ })
    .click()
  await expect(await opened).toHaveURL(/\/options\.html$/)
})

test('a changed setting is saved and reaches the preview', async ({ context, background }) => {
  const other = await context.newPage()
  await other.goto(`${TEST_ORIGIN}/Delta%20notes`)
  const page = await context.newPage()
  await openSettings(page, background)

  // The browser's own wording, with the shortcut in the middle of it.
  await expect(page.getByText(/^Press Alt\+Q on any page/)).toBeVisible()

  await page.getByRole('switch', { name: 'Open tabs' }).click()
  await expect
    .poll(() => storedSettings(background))
    .toMatchObject({ sources: { tabs: false, history: true } })

  await preview(page).getByRole('combobox').fill('delta')
  const openTabs = preview(page).getByRole('group', { name: 'Open tabs' })
  await expect(preview(page).getByRole('option', { name: /Search the web/ })).toBeVisible()
  await expect(openTabs).toHaveCount(0)

  await page.getByRole('switch', { name: 'Open tabs' }).click()
  await expect(openTabs.getByRole('option', { name: /Delta notes/ })).toBeVisible()
})

test('the preview never acts on what it shows', async ({ context, background }) => {
  const other = await context.newPage()
  await other.goto(`${TEST_ORIGIN}/Epsilon`)
  const page = await context.newPage()
  await openSettings(page, background)
  const pages = context.pages().length

  const input = preview(page).getByRole('combobox')
  await expect(input).not.toBeFocused()
  await input.fill('epsilon')
  await expect(preview(page).getByRole('option', { name: /Epsilon/ })).toBeVisible()
  await input.press('Enter')
  await input.press('Escape')

  await expect(input).toHaveValue('')
  expect(page.url()).toMatch(/\/options\.html$/)
  expect(context.pages().length).toBe(pages)
})

test('picking a theme restyles the page', async ({ context, background }) => {
  const page = await context.newPage()
  await openSettings(page, background)
  await page.getByRole('radio', { name: 'Dark', exact: true }).check()
  await page.getByRole('radio', { name: 'Moss' }).check()

  const panel = () =>
    page.evaluate(() => document.documentElement.style.getPropertyValue('--al-panel'))
  await expect.poll(panel).toBe('#1E2420')
})
