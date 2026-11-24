import {
  expect,
  openPage,
  paletteFrame,
  paletteText,
  pressOpenAloft,
  setKeywords,
  tabUrls,
  test,
} from './fixtures'

const testKeyword = (origin: string) => ({
  id: 'custom-test',
  name: 'Test Search',
  keyword: 'ts',
  url: `${origin}/Results?q=%s`,
  enabled: true,
})

test('a keyword and Space search that site', async ({ firefox, control, origin }) => {
  await setKeywords(control, { builtIn: {}, custom: [testKeyword(origin)] })
  const page = await openPage(firefox, control, `${origin}/Start`)
  await pressOpenAloft(control, page)
  const palette = await paletteFrame(page)

  await page.keyboard.type('ts lofi beats')
  await expect
    .poll(() => palette.evaluate(() => document.querySelector('input')?.placeholder))
    .toBe('Search Test Search')
  await page.keyboard.press('Enter')

  await expect.poll(() => tabUrls(control)).toContain(`${origin}/Results?q=lofi%20beats`)
})

test('@ lists the keywords', async ({ firefox, control, origin }) => {
  await setKeywords(control, { builtIn: {}, custom: [testKeyword(origin)] })
  const page = await openPage(firefox, control, `${origin}/Start`)
  await pressOpenAloft(control, page)
  const palette = await paletteFrame(page)

  // Neither keyboard.type('@') nor sendCharacter reach the input in Firefox;
  // the key itself, as a US layout types it, does.
  await page.keyboard.down('Shift')
  await page.keyboard.press('Digit2')
  await page.keyboard.up('Shift')

  await expect.poll(() => paletteText(palette)).toContain('Test Search')
})
