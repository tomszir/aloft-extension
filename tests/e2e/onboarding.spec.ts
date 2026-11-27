import type { BrowserContext, Page } from '@playwright/test'
import { expect, TEST_ORIGIN, test } from './fixtures'

const onboardingPage = async (context: BrowserContext) => {
  const isOnboarding = (p: Page) => p.url().endsWith('/onboarding.html')
  return context.pages().find(isOnboarding) ?? (await context.waitForEvent('page', isOnboarding))
}

test('first install shows the shortcut, and how to make Ctrl+T open Aloft', async ({ context }) => {
  const onboarding = await onboardingPage(context)
  await expect(onboarding.getByRole('heading', { name: 'Aloft is ready' })).toBeVisible()
  await expect(onboarding.getByText(/^Press Alt\+Q on any page/)).toBeVisible()
  // Nothing asks for access to every site any more.
  await expect(onboarding.getByRole('button', { name: /all sites/ })).toHaveCount(0)

  const ctrlT = onboarding.getByRole('region', { name: 'Open with Ctrl+T' })
  await expect(ctrlT.getByText(/Open Aloft \(second shortcut, like Ctrl\+T\)/)).toBeVisible()
  const opened = context.waitForEvent('page')
  await ctrlT.getByRole('button', { name: 'Open shortcut settings' }).click()
  await expect(await opened).toHaveURL('chrome://extensions/shortcuts')
})

test("Ctrl+T opens the browser's own new tab unless it was given to Aloft", async ({
  context,
  background,
}) => {
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Reading`)
  const created = context.waitForEvent('page')
  await background.evaluate(async () => {
    const api = Reflect.get(globalThis, 'chrome') as {
      tabs: { create: (props: object) => Promise<unknown> }
    }
    await api.tabs.create({})
  })
  const newTab = await created
  // It stays, and Aloft isn't drawn on the page it came from.
  await expect(newTab).not.toHaveURL(/palette|newtab\.html/)
  await page.waitForTimeout(300)
  expect(newTab.isClosed()).toBe(false)
  await expect(page.locator('iframe[title="Aloft"]')).toHaveCount(0)
})
