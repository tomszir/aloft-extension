import type { Page } from 'puppeteer-core'
import { expect, tabUrls, test } from './fixtures'

test("Change shortcut opens Firefox's shortcut settings", async ({ control }) => {
  // The control page is Aloft's settings page.
  await control.locator('button ::-p-text(Change shortcut)').click()

  await expect
    .poll(async () => (await tabUrls(control)).some((url) => url.startsWith('about:addons')))
    .toBe(true)
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

type Sync = {
  storage: {
    sync: {
      get: (key: string) => Promise<Record<string, unknown>>
      set: (items: object) => Promise<void>
      clear: () => Promise<void>
    }
  }
}

function stored(control: Page, key: string): Promise<unknown> {
  return control.evaluate(async (name) => {
    const api = Reflect.get(globalThis, 'browser') as Sync
    return (await api.storage.sync.get(name))[name]
  }, key)
}

test('a backup exported from settings restores them', async ({ control }) => {
  await control.evaluate(
    async (theme, keyword) => {
      const api = Reflect.get(globalThis, 'browser') as Sync
      await api.storage.sync.set({
        settings: {
          enterOpensIn: 'current-tab',
          appearance: { colorScheme: 'dark', darkTheme: theme.id },
        },
        themes: [theme],
        keywords: { builtIn: { youtube: { enabled: false } }, custom: [keyword] },
      })
    },
    EMBER,
    DOCS,
  )
  await expect
    .poll(() =>
      control.evaluate(() => document.querySelector('input[value="custom-ember"]') !== null),
    )
    .toBe(true)

  // The file the Export button hands the browser, kept instead of downloaded:
  // a download in headless Firefox would need its own profile settings.
  await control.evaluate(() => {
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      Reflect.set(globalThis, 'aloftDownload', { name: this.download, href: this.href })
    }
  })
  await control.locator('#backup button ::-p-text(Export)').click()
  const exported = await control.evaluate(async () => {
    const download = Reflect.get(globalThis, 'aloftDownload') as { name: string; href: string }
    return { name: download.name, text: await (await fetch(download.href)).text() }
  })
  expect(exported.name).toMatch(/^aloft-backup-\d{4}-\d{2}-\d{2}\.json$/)
  await control.evaluate(async () => {
    await (Reflect.get(globalThis, 'browser') as Sync).storage.sync.clear()
  })
  await expect.poll(() => stored(control, 'themes')).toBeUndefined()

  // Firefox's remote protocol can't set files on an extension page, so the
  // file goes to the input as a picked one would.
  await control.evaluate((text) => {
    const input = document.querySelector<HTMLInputElement>('#backup input[type="file"]')
    if (!input) throw new Error('no backup input')
    const picked = new DataTransfer()
    picked.items.add(new File([text], 'backup.json', { type: 'application/json' }))
    input.files = picked.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, exported.text)
  await control.waitForSelector('#backup [role="alert"] ::-p-text(Adds 1 theme.)')
  await control.waitForSelector('#backup [role="alert"] ::-p-text(Adds 1 keyword.)')
  // Nothing is saved until it's confirmed.
  expect(await stored(control, 'themes')).toBeUndefined()
  await control.locator('#backup [role="alert"] button ::-p-text(Restore)').click()

  await expect.poll(() => stored(control, 'themes')).toEqual([EMBER])
  await expect
    .poll(() => stored(control, 'keywords'))
    .toEqual({ builtIn: { youtube: { enabled: false } }, custom: [DOCS] })
  await expect
    .poll(() => stored(control, 'settings'))
    .toMatchObject({
      enterOpensIn: 'current-tab',
      appearance: { colorScheme: 'dark', darkTheme: EMBER.id },
    })
})
