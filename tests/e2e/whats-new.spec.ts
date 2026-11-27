import type { Worker } from '@playwright/test'
import { expect, pressOpenAloft, TEST_ORIGIN, test } from './fixtures'

/** What the background stores after an update from `from` worth mentioning. */
async function updatedFrom(background: Worker, from: string): Promise<void> {
  await background.evaluate(async (version) => {
    const api = Reflect.get(globalThis, 'chrome') as {
      storage: { local: { set: (items: object) => Promise<void> } }
    }
    await api.storage.local.set({ whatsNew: { from: version, until: Date.now() + 60_000 } })
  }, from)
}

test("after an update, the footer offers what's new until the settings page shows it", async ({
  context,
  background,
}) => {
  await updatedFrom(background, '0.4.1')
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/`)
  await pressOpenAloft(background, page)

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

  // Seen now: the palette stops offering it, and the settings page stops saying it.
  await page.bringToFront()
  await pressOpenAloft(background, page)
  await expect(palette.getByRole('combobox')).toBeFocused()
  await expect(link).toHaveCount(0)
  await settings.reload()
  await expect(settings.getByRole('region', { name: "What's new" })).toBeVisible()
  await expect(settings.getByText(/^Aloft was updated to/)).toHaveCount(0)
})

test("without an update, the footer doesn't mention one", async ({ context, background }) => {
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/`)
  await pressOpenAloft(background, page)
  const palette = page.locator('iframe[title="Aloft"]').contentFrame()
  await expect(palette.getByRole('combobox')).toBeFocused()
  await expect(palette.getByRole('button', { name: /^What's new in / })).toHaveCount(0)
})
