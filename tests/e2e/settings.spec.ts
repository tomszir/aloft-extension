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
    .getByRole('option', { name: /Aloft settings/ })
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

  // Back on, the tab is the best match, above the search.
  await page.getByRole('switch', { name: 'Open tabs' }).click()
  await expect(preview(page).getByRole('option').first()).toContainText('Delta notes')
})

test('the preview shows either theme while Aloft follows the system', async ({
  context,
  background,
}) => {
  const page = await context.newPage()
  await page.setViewportSize({ width: 1440, height: 900 })
  await openSettings(page, background)
  const scheme = () =>
    preview(page)
      .locator('html')
      .evaluate((root) => root.dataset.scheme)
  await page.getByRole('group', { name: 'Preview in' }).getByRole('radio', { name: 'Dark' }).check()
  await expect.poll(scheme).toBe('dark')
  await page
    .getByRole('group', { name: 'Preview in' })
    .getByRole('radio', { name: 'Light' })
    .check()
  await expect.poll(scheme).toBe('light')
  // Wide enough for both columns: the settings scroll, the page doesn't.
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(900)
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
  await page
    .getByRole('group', { name: 'Color scheme' })
    .getByRole('radio', { name: 'Dark', exact: true })
    .check()
  await page.getByRole('radio', { name: 'Moss' }).check()

  const panel = () =>
    page.evaluate(() => document.documentElement.style.getPropertyValue('--al-panel'))
  await expect.poll(panel).toBe('#1E2420')
})

test("the shortcut on Aloft's own pages opens the palette beside them", async ({
  context,
  background,
}) => {
  const page = await context.newPage()
  await openSettings(page, background)
  const opened = context.waitForEvent('page')
  await pressOpenAloft(background, page)
  const paletteTab = await opened
  await expect(paletteTab).toHaveURL(/\/palette\.html\?host=tab$/)
  await expect(paletteTab.getByRole('combobox')).toBeFocused()
})

test('saving a setting keeps ones a newer Aloft stored', async ({ context, background }) => {
  await background.evaluate(async () => {
    const api = Reflect.get(globalThis, 'chrome') as {
      storage: { sync: { set: (items: object) => Promise<void> } }
    }
    await api.storage.sync.set({ settings: { fromTheFuture: 1, learnFromPicks: true } })
  })
  const page = await context.newPage()
  await openSettings(page, background)
  await page.getByRole('switch', { name: 'Learn from what you pick' }).click()
  await expect
    .poll(() => storedSettings(background))
    .toMatchObject({ fromTheFuture: 1, learnFromPicks: false })
})

test('a customized theme is previewed while edited, then used by Aloft once saved', async ({
  context,
  background,
}) => {
  const page = await context.newPage()
  await page.setViewportSize({ width: 1440, height: 900 })
  await openSettings(page, background)
  await page.getByRole('button', { name: 'New theme' }).first().click()
  const form = page.getByRole('form', { name: 'New theme' })
  await form.getByRole('textbox', { name: 'Name' }).fill('Ember')
  await form.getByRole('textbox', { name: 'Background', exact: true }).fill('#FFF4EC')
  await form.getByRole('textbox', { name: 'Background', exact: true }).press('Tab')
  await form.getByRole('slider').fill('6')

  const panel = (root: Page | ReturnType<typeof preview>) =>
    root.locator('html').evaluate((html) => html.style.getPropertyValue('--al-panel'))
  await expect.poll(() => panel(preview(page))).toBe('#FFF4EC')

  await form.getByRole('button', { name: 'Save theme' }).click()
  await expect(page.getByRole('radio', { name: 'Ember' })).toBeChecked()

  const host = await context.newPage()
  await host.goto(`${TEST_ORIGIN}/Host`)
  await pressOpenAloft(background, host)
  const radius = () =>
    palette(host)
      .locator('html')
      .evaluate((html) => html.style.getPropertyValue('--al-radius'))
  await expect.poll(() => panel(palette(host))).toBe('#FFF4EC')
  await expect.poll(radius).toBe('6px')
})

test('font and density reach the palette', async ({ context, background }) => {
  await setSettingsAppearance(background, { font: 'mono', density: 'compact' })
  const host = await context.newPage()
  await host.goto(`${TEST_ORIGIN}/Host`)
  await pressOpenAloft(background, host)
  const css = (name: string) =>
    palette(host)
      .locator('html')
      .evaluate((html, prop) => html.style.getPropertyValue(prop), name)
  await expect.poll(() => css('--al-font-family')).toMatch(/monospace$/)
  await expect.poll(() => css('--al-row-height')).toBe('36px')
})

async function setSettingsAppearance(background: Worker, appearance: object): Promise<void> {
  await background.evaluate(async (value) => {
    const api = Reflect.get(globalThis, 'chrome') as {
      storage: { sync: { set: (items: object) => Promise<void> } }
    }
    await api.storage.sync.set({ settings: { appearance: value } })
  }, appearance)
}

test('the menu jumps to a section and marks it, as does scrolling', async ({
  context,
  background,
}) => {
  const page = await context.newPage()
  await page.setViewportSize({ width: 1440, height: 900 })
  await openSettings(page, background)
  const menu = page.getByRole('navigation', { name: 'Settings sections' })
  await menu.getByRole('link', { name: 'Appearance' }).click()
  await expect(menu.getByRole('link', { name: 'Appearance' })).toHaveAttribute(
    'aria-current',
    'location',
  )
  // Keyboard focus goes along, so the next Tab is in that section.
  await expect(page.locator('#al-appearance-title')).toBeFocused()
  await expect
    .poll(() =>
      page.locator('#appearance').evaluate((el) => Math.round(el.getBoundingClientRect().top)),
    )
    .toBeLessThan(40)

  await page.locator('#whats-new').evaluate((el) => el.scrollIntoView())
  await expect(menu.getByRole('link', { name: "What's new" })).toHaveAttribute(
    'aria-current',
    'location',
  )
})

const EMBER = {
  id: 'custom-ember',
  name: 'Ember',
  scheme: 'dark',
  radius: 6,
  colors: {
    panel: '#1A1110',
    selected: '#2A1C1A',
    border: '#3A2522',
    text: '#F5E6E2',
    muted: '#C2A8A2',
    accent: '#FF7A45',
  },
}
const DOCS = {
  id: 'custom-docs',
  name: 'Docs',
  keyword: 'docs',
  url: 'https://docs.example/?q=%s',
  enabled: true,
}

async function syncStorage(background: Worker, change: 'clear' | object): Promise<void> {
  await background.evaluate(async (value) => {
    const api = Reflect.get(globalThis, 'chrome') as {
      storage: { sync: { set: (items: object) => Promise<void>; clear: () => Promise<void> } }
    }
    if (value === 'clear') await api.storage.sync.clear()
    else await api.storage.sync.set(value)
  }, change)
}

async function stored(background: Worker, key: string): Promise<unknown> {
  return background.evaluate(async (name) => {
    const api = Reflect.get(globalThis, 'chrome') as {
      storage: { sync: { get: (key: string) => Promise<Record<string, unknown>> } }
    }
    return (await api.storage.sync.get(name))[name]
  }, key)
}

test('a backup exported from settings restores them, and the preview follows', async ({
  context,
  background,
}) => {
  await syncStorage(background, {
    settings: {
      enterOpensIn: 'current-tab',
      appearance: { colorScheme: 'dark', darkTheme: EMBER.id },
    },
    themes: [EMBER],
    keywords: { builtIn: { youtube: { enabled: false } }, custom: [DOCS] },
  })
  const page = await context.newPage()
  await page.setViewportSize({ width: 1440, height: 900 })
  await openSettings(page, background)
  const panel = () =>
    preview(page)
      .locator('html')
      .evaluate((html) => html.style.getPropertyValue('--al-panel'))
  await expect.poll(panel).toBe(EMBER.colors.panel)

  const backup = page.getByRole('region', { name: 'Backup' })
  const downloading = page.waitForEvent('download')
  await backup.getByRole('button', { name: 'Export', exact: true }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toMatch(/^aloft-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const file = await download.path()

  // Back to how Aloft ships, as on a new computer.
  await syncStorage(background, 'clear')
  await expect(page.getByRole('radio', { name: 'Ember' })).toHaveCount(0)
  await expect.poll(panel).not.toBe(EMBER.colors.panel)

  await backup.locator('input[type="file"]').setInputFiles(file)
  const ask = backup.getByRole('alert')
  await expect(ask).toContainText('Restore this backup?')
  await expect(ask).toContainText('Adds 1 theme.')
  await expect(ask).toContainText('Adds 1 keyword.')
  // Nothing is saved until it's confirmed.
  expect(await stored(background, 'themes')).toBeUndefined()
  await ask.getByRole('button', { name: 'Restore', exact: true }).click()
  await expect(backup.getByText('Restored from the backup.')).toBeVisible()

  await expect.poll(() => stored(background, 'themes')).toEqual([EMBER])
  await expect
    .poll(() => stored(background, 'keywords'))
    .toEqual({ builtIn: { youtube: { enabled: false } }, custom: [DOCS] })
  await expect
    .poll(() => storedSettings(background))
    .toMatchObject({
      enterOpensIn: 'current-tab',
      appearance: { colorScheme: 'dark', darkTheme: EMBER.id },
    })
  await expect(page.getByRole('radio', { name: 'Ember' })).toBeChecked()
  await expect.poll(panel).toBe(EMBER.colors.panel)
})
