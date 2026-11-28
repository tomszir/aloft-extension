import {
  activeTabUrl,
  expect,
  openInNewWindow,
  openPage,
  paletteFrame,
  paletteText,
  pressOpenAloft,
  selectedRow,
  test,
} from './fixtures'

test.use({ inPrivate: true })

test('a private window teaches Aloft nothing and shows nothing in a normal one', async ({
  firefox,
  control,
  origin,
}) => {
  const page = await openInNewWindow(firefox, control, `${origin}/Private host`, true)
  // Opened in the private window just used.
  const open = await openPage(firefox, control, `${origin}/Private open`)
  await (await openPage(firefox, control, `${origin}/Private closed`)).close()
  await page.bringToFront()

  // A pick in a private window would be kept on disk.
  await pressOpenAloft(control, page)
  const palette = await paletteFrame(page)
  await page.keyboard.type('private op')
  await expect.poll(() => selectedRow(palette)).toContain('Private open')
  await page.keyboard.press('Enter')
  await expect.poll(() => activeTabUrl(control)).toBe(open.url())
  const learned = await control.evaluate(async () => {
    const api = Reflect.get(globalThis, 'browser') as {
      storage: { local: { get: (key: string) => Promise<Record<string, unknown>> } }
    }
    return (await api.storage.local.get('learned')).learned
  })
  expect(learned).toBeUndefined()

  const normal = await openInNewWindow(firefox, control, `${origin}/Normal`, false)
  // In the window just opened, so closing it leaves a closed tab, not a window.
  await (await openPage(firefox, control, `${origin}/Normal closed`)).close()
  await normal.bringToFront()
  await pressOpenAloft(control, normal)
  const normalPalette = await paletteFrame(normal)
  await expect.poll(() => paletteText(normalPalette)).toContain('Normal closed')
  expect(await paletteText(normalPalette)).not.toContain('Private')
  await normal.keyboard.type('private')
  // The search row shows once the results for the text are in.
  await expect.poll(() => paletteText(normalPalette)).toContain('Search')
  expect(await paletteText(normalPalette)).not.toContain('Private')
})
