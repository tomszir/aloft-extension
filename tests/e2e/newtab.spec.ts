import type { BrowserContext, Page } from '@playwright/test'
import { activeTabUrl, expect, pressNewTab, setSettings, TEST_ORIGIN, test } from './fixtures'

const NEW_TAB_PAGE = /^chrome-extension:\/\/[^/]+\/newtab\.html(\?focus)?$/

const onboardingPage = async (context: BrowserContext) => {
  const isOnboarding = (p: Page) => p.url().endsWith('/onboarding.html')
  return context.pages().find(isOnboarding) ?? (await context.waitForEvent('page', isOnboarding))
}

test('first install opens the onboarding page, which sees the granted access', async ({
  context,
}) => {
  const onboarding = await onboardingPage(context)
  await expect(onboarding.getByRole('heading', { name: 'Aloft is ready' })).toBeVisible()
  await expect(onboarding.getByText('Ctrl+T now opens Aloft')).toBeVisible()
})

test('Ctrl+T opens Aloft over the page instead of a new tab', async ({ context, background }) => {
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Reading`)
  await page.bringToFront()
  const tabsBefore = context.pages().length

  await pressNewTab(background)

  const frame = page.locator('iframe[title="Aloft"]')
  await expect(frame).toBeVisible()
  await expect(frame.contentFrame().getByRole('combobox')).toBeFocused()
  await expect.poll(() => activeTabUrl(background)).toBe(`${TEST_ORIGIN}/Reading`)
  await expect.poll(() => context.pages().length).toBe(tabsBefore)
})

test('Ctrl+T keeps what is typed while Aloft opens', async ({ context, background }) => {
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Reading`)
  await page.locator('#field').focus()
  await page.bringToFront()

  await pressNewTab(background)
  const frame = page.locator('iframe[title="Aloft"]')
  await expect(frame).toBeAttached()
  await page.keyboard.type('notes')

  await expect(frame.contentFrame().getByRole('combobox')).toHaveValue('notes')
  await expect(page.locator('#field')).toHaveValue('')
})

test('on a page Aloft cannot draw on, the new tab stays and is the palette', async ({
  context,
  background,
}) => {
  const page = await context.newPage()
  await page.goto('chrome://version')
  await page.bringToFront()

  const created = context.waitForEvent('page')
  await pressNewTab(background)
  const newTab = await created
  await expect(newTab).toHaveURL(NEW_TAB_PAGE)
  const input = newTab.getByRole('combobox')
  await expect(input).toBeFocused()

  // Esc clears instead of closing: this is often a window's only tab.
  await input.fill('something')
  await newTab.keyboard.press('Escape')
  await expect(input).toHaveValue('')
  expect(newTab.isClosed()).toBe(false)
})

test('with Ctrl+T replacement off, the new tab is left alone', async ({ context, background }) => {
  await setSettings(background, { replaceNewTab: false })
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Reading`)
  await page.bringToFront()

  const created = context.waitForEvent('page')
  await pressNewTab(background)
  await expect(await created).toHaveURL(NEW_TAB_PAGE)
  await expect(page.locator('iframe[title="Aloft"]')).toHaveCount(0)
})
