// The web demo on a stand-in for the page it's made for (src/demo/dev), with
// that page's CSP. Needs `pnpm demo:build`, which `pnpm test:e2e` runs.
import { expect, type Page, test } from '@playwright/test'
import { type DemoServer, serveDemo } from '../../scripts/demo-server.ts'

let server: DemoServer

test.beforeAll(async () => {
  server = await serveDemo()
})

test.afterAll(async () => {
  await server.close()
})

// The page's own files are all it may ask for.
const PAGE_FILES = ['/', '/fonts.css', '/dev.css', '/dev.js', '/aloft-demo.js', '/favicon.ico']

async function open(page: Page) {
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  // Added before the page's own scripts, so nothing it does goes unseen.
  await page.addInitScript(() => {
    const seen: string[] = []
    Reflect.set(window, 'cspViolations', seen)
    document.addEventListener('securitypolicyviolation', (event) =>
      seen.push(`${event.violatedDirective} ${event.blockedURI}`),
    )
  })
  await page.goto(server.url)
  // Nothing of the demo's is loaded before it's asked for.
  expect(requests.some((url) => url.endsWith('/aloft-demo.js'))).toBe(false)
  return {
    requests,
    async expectClean() {
      expect(errors).toEqual([])
      expect(await page.evaluate(() => Reflect.get(window, 'cspViolations'))).toEqual([])
      for (const url of requests) {
        const { origin, pathname } = new URL(url)
        expect(origin).toBe(new URL(server.url).origin)
        const isFont = pathname.startsWith('/fonts/')
        expect(isFont || PAGE_FILES.includes(pathname), pathname).toBe(true)
      }
    },
  }
}

const tour = (page: Page) => page.getByRole('region', { name: 'Tour' })
const search = (page: Page) => page.getByRole('combobox')
const step = (page: Page, n: number) => expect(tour(page)).toContainText(`${n} / 5`)

test('the tour, start to finish by keyboard', async ({ page }) => {
  const visit = await open(page)
  await page.getByRole('button', { name: 'Try Aloft' }).focus()
  await page.keyboard.press('Enter')
  await expect(search(page)).toBeFocused()
  await step(page, 1)

  await page.keyboard.type('hand')
  await expect(page.getByRole('option', { name: /Team handbook/ })).toBeVisible()
  await step(page, 2)

  await page.keyboard.press('Alt+1')
  await expect(page.locator('#note')).toHaveText('Would switch to Inbox — Postbox')
  await step(page, 3)
  await expect(search(page)).toBeFocused()

  await page.keyboard.type('>pin')
  await page.keyboard.press('Enter')
  await step(page, 4)
  // The bar came back with the tab it's over among the pins.
  await expect(page.getByRole('button', { name: /Keyboard-first browsing/ })).toBeVisible()

  await page.keyboard.type('yt ')
  await expect(search(page)).toHaveAttribute('placeholder', 'Search YouTube')
  await step(page, 5)

  // Shift+Tab reaches the tour's controls: Finish, Skip, then the theme.
  await page.keyboard.press('Shift+Tab')
  await expect(tour(page).getByRole('button', { name: 'Finish' })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Shift+Tab')
  await expect(tour(page).getByRole('radio', { name: 'Instrument Dark' })).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(tour(page).getByRole('radio', { name: 'Instrument Light' })).toBeChecked()
  await expect(tour(page)).toContainText('Done.')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await expect(page.locator('#install')).toBeVisible()
  await expect(tour(page)).toHaveCount(0)
  await expect(search(page)).toBeFocused()

  // Esc leaves the chip, then closes, and the page gets its focus back.
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await expect(search(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Try Aloft' })).toBeFocused()
  await visit.expectClean()
})

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })

  test('the tour, start to finish by tapping', async ({ page }) => {
    const visit = await open(page)
    await page.getByRole('button', { name: 'Try Aloft' }).tap()
    await step(page, 1)

    await search(page).fill('hand')
    await step(page, 2)
    await expect(tour(page)).toContainText('tap a pinned tab')

    await search(page).fill('')
    await page.getByRole('button', { name: /Week 48 — Daybook/ }).tap()
    await expect(page.locator('#note')).toHaveText('Would switch to Week 48 — Daybook')
    await step(page, 3)

    await search(page).fill('>')
    await page.getByRole('option', { name: /Pin tab/ }).tap()
    await step(page, 4)

    await search(page).fill('@')
    await page.getByRole('option', { name: /YouTube/ }).tap()
    await step(page, 5)

    await tour(page).getByRole('radio', { name: 'Instrument Light' }).tap()
    await expect(tour(page).getByRole('radio', { name: 'Instrument Light' })).toBeChecked()
    await tour(page).getByRole('button', { name: 'Finish' }).tap()
    await expect(page.locator('#install')).toBeVisible()
    await visit.expectClean()
  })
})

test('skipping the tour leaves the bar, and a click outside closes it', async ({ page }) => {
  const visit = await open(page)
  await page.getByRole('button', { name: 'Try Aloft' }).click()
  await tour(page).getByRole('button', { name: 'Skip tour' }).click()
  await expect(tour(page)).toHaveCount(0)
  await expect(search(page)).toBeFocused()
  await page.mouse.click(10, 10)
  await expect(search(page)).toHaveCount(0)
  await expect(page.locator('#install')).toBeHidden()
  await visit.expectClean()
})
