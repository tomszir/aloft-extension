import {
  expect,
  palettePainted,
  pressOpenAloft,
  sendPaletteKey,
  TEST_ORIGIN,
  test,
} from './fixtures'

test('opens over the page, takes focus, and Esc gives it back', async ({ context, background }) => {
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/`)
  await page.locator('#field').focus()

  await pressOpenAloft(background, page)

  const frame = page.locator('iframe[title="Aloft"]')
  await expect(frame).toBeVisible()
  await expect(frame).toHaveAttribute('src', /^chrome-extension:\/\/.+\/palette\.html$/)

  const input = frame.contentFrame().getByRole('combobox')
  await expect(input).toBeFocused()

  await sendPaletteKey(page, { key: 'Escape' })
  await expect(frame).toHaveCount(0)
  await expect(page.locator('#field')).toBeFocused()
})

test('the page cannot read anything inside the palette', async ({ context, background }) => {
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/`)
  await pressOpenAloft(background, page)
  await expect(page.locator('iframe[title="Aloft"]')).toBeVisible()

  const leaked = await page.evaluate(() => {
    const iframe = document.querySelector('iframe')
    try {
      return iframe?.contentDocument?.body?.innerHTML ?? null
    } catch {
      return null
    }
  })
  expect(leaked).toBeNull()
})

test('pressing the shortcut again closes it', async ({ context, background }) => {
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/`)

  await pressOpenAloft(background, page)
  await expect(page.locator('iframe[title="Aloft"]')).toBeVisible()
  await pressOpenAloft(background, page)
  await expect(page.locator('iframe[title="Aloft"]')).toHaveCount(0)
})

test('on browser pages it opens as a tab of its own', async ({ context, background }) => {
  const page = await context.newPage()
  await page.goto('chrome://version')

  const paletteTab = context.waitForEvent('page')
  await pressOpenAloft(background, page)
  const palette = await paletteTab
  await expect(palette).toHaveURL(/\/palette\.html\?host=tab$/)
  await expect(palette.getByRole('combobox')).toBeFocused()
})

test("cancels the site's own zoom so Aloft looks the same everywhere", async ({
  context,
  background,
}) => {
  const page = await context.newPage()
  await page.goto(`${TEST_ORIGIN}/Zoomed`)
  await background.evaluate(async (url) => {
    const api = Reflect.get(globalThis, 'chrome') as {
      tabs: {
        query: (q: object) => Promise<{ id?: number; url?: string }[]>
        setZoom: (id: number, factor: number) => Promise<void>
      }
    }
    const tab = (await api.tabs.query({})).find((t) => t.url === url)
    if (tab?.id !== undefined) await api.tabs.setZoom(tab.id, 0.5)
  }, page.url())

  await pressOpenAloft(background, page)
  const frame = page.locator('iframe[title="Aloft"]').contentFrame()
  await expect(frame.getByRole('combobox')).toBeFocused()
  await expect
    .poll(() => frame.locator('html').evaluate((el) => (el as HTMLElement).style.zoom))
    .toBe('2')
})

// A page's modal dialog or popover sits in the top layer, above any z-index,
// and a modal dialog also makes the rest of the page inert.
for (const [name, open] of [
  [
    'modal dialog',
    'const d = document.createElement("dialog"); document.body.append(d); d.showModal()',
  ],
  [
    'popover',
    'const p = document.createElement("div"); p.popover = "manual"; document.body.append(p); p.showPopover()',
  ],
] as const) {
  test(`opens above a page's open ${name} and takes typing`, async ({ context, background }) => {
    const page = await context.newPage()
    await page.goto(`${TEST_ORIGIN}/`)
    await page.evaluate(open)

    await pressOpenAloft(background, page)
    const frame = page.locator('iframe[title="Aloft"]')
    await expect(frame).toBeVisible()
    await palettePainted(page)

    const topmost = await page.evaluate(() => {
      const [x, y] = [innerWidth / 2, innerHeight / 2]
      const hit = document.elementFromPoint(x, y)
      return (hit?.shadowRoot?.elementFromPoint(x, y) ?? hit)?.tagName
    })
    expect(topmost).toBe('IFRAME')
    const input = frame.contentFrame().getByRole('combobox')
    await expect(input).toBeFocused()
    await page.keyboard.type('abc')
    await expect(input).toHaveValue('abc')

    await sendPaletteKey(page, { key: 'Escape' })
    await expect(frame).toHaveCount(0)
    await expect(page.locator('dialog[open], :popover-open')).toHaveCount(1)
  })
}
