import type { Worker } from '@playwright/test'
import {
  expect,
  palettePainted,
  pressOpenAloft,
  sendPaletteKey,
  setSettings,
  TEST_ORIGIN,
  test,
} from './fixtures'

/** What the background stores after an update from `from` worth mentioning. */
async function updatedFrom(background: Worker, from: string): Promise<void> {
  await background.evaluate(async (version) => {
    const api = Reflect.get(globalThis, 'chrome') as {
      storage: { local: { set: (items: object) => Promise<void> } }
    }
    await api.storage.local.set({ whatsNew: { from: version, until: Date.now() + 60_000 } })
  }, from)
}

test("after an update, the footer mentions what's new and opens it", async ({
  context,
  background,
}) => {
  await updatedFrom(background, '0.4.1')
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/`)
  await pressOpenAloft(background, page)

  await palettePainted(page)
  const palette = page.locator('iframe[title="Aloft"]').contentFrame()
  const link = palette.getByRole('button', { name: /^What's new in / })
  const opened = context.waitForEvent('page')
  await link.click()
  const settings = await opened
  await expect(settings).toHaveURL(/\/options\.html#whats-new$/)
  await expect(settings.getByText(/^Aloft was updated to/)).toBeVisible()
  const section = settings.getByRole('region', { name: "What's new" })
  await expect(section.getByRole('heading', { name: /^0\.5\.0/ })).toBeVisible()
  await expect(section.getByText('New', { exact: true }).first()).toBeVisible()
  await expect(page.locator('iframe[title="Aloft"]')).toHaveCount(0)

  // Seen now: the settings page stops saying it.
  await settings.reload()
  await expect(settings.getByRole('region', { name: "What's new" })).toBeVisible()
  await expect(settings.getByText(/^Aloft was updated to/)).toHaveCount(0)
})

test('the footer mentions an update only the first time Aloft opens', async ({
  context,
  background,
}) => {
  await updatedFrom(background, '0.4.1')
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/`)
  const palette = page.locator('iframe[title="Aloft"]').contentFrame()
  const link = palette.getByRole('button', { name: /^What's new in / })

  await pressOpenAloft(background, page)
  await expect(link).toBeVisible()
  await sendPaletteKey(page, { key: 'Escape' })
  await expect(page.locator('iframe[title="Aloft"]')).toHaveCount(0)

  await pressOpenAloft(background, page)
  await expect(palette.getByRole('combobox')).toBeFocused()
  await expect(link).toHaveCount(0)
})

test('with mentions switched off, the footer stays quiet after an update', async ({
  context,
  background,
}) => {
  await setSettings(background, { whatsNewInAloft: false })
  await updatedFrom(background, '0.4.1')
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/`)
  await pressOpenAloft(background, page)
  const palette = page.locator('iframe[title="Aloft"]').contentFrame()
  await expect(palette.getByRole('combobox')).toBeFocused()
  // Settings arrive after the first paint; give a wrong mention time to show.
  await page.waitForTimeout(300)
  await expect(palette.getByRole('button', { name: /^What's new in / })).toHaveCount(0)
})

test("without an update, the footer doesn't mention one", async ({ context, background }) => {
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/`)
  await pressOpenAloft(background, page)
  const palette = page.locator('iframe[title="Aloft"]').contentFrame()
  await expect(palette.getByRole('combobox')).toBeFocused()
  await expect(palette.getByRole('button', { name: /^What's new in / })).toHaveCount(0)
})
