// Renders the PNGs browsers and the Chrome Web Store need from the SVG
// sources in assets/brand/. Manifest icons can't be SVG, and each small size
// has its own drawing aligned to whole pixels, so it stays sharp instead of
// being a blurry downscale of the large one.
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { chromium } from '@playwright/test'

const BRAND = resolve('assets/brand')

const OUTPUTS = [
  { svg: 'icon-16.svg', png: 'public/icon/16.png', width: 16, height: 16 },
  { svg: 'icon-32.svg', png: 'public/icon/32.png', width: 32, height: 32 },
  { svg: 'icon-48.svg', png: 'public/icon/48.png', width: 48, height: 48 },
  { svg: 'icon-128.svg', png: 'public/icon/128.png', width: 128, height: 128 },
  { svg: 'promo-440x280.svg', png: 'assets/brand/promo-440x280.png', width: 440, height: 280 },
]

const executablePath = process.env.ALOFT_BROWSER || undefined

// The promo tile sets words in Sora, the store images' typeface; inlined from
// the package so nothing is fetched and every machine renders the same.
const SORA = await readFile(
  resolve('node_modules/@fontsource-variable/sora/files/sora-latin-wght-normal.woff2'),
)
const FONT_CSS = `@font-face{font-family:Sora;src:url(data:font/woff2;base64,${SORA.toString('base64')}) format('woff2');font-weight:100 900}`
const browser = await chromium.launch(
  executablePath ? { executablePath, headless: true } : { channel: 'chromium', headless: true },
)
try {
  for (const { svg, png, width, height } of OUTPUTS) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
    const source = await readFile(join(BRAND, svg), 'utf8')
    const sized = source.replace('<svg ', `<svg width="${width}" height="${height}" `)
    await page.setContent(
      `<!doctype html><style>${FONT_CSS}</style><body style="margin:0">${sized}</body>`,
    )
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: png, omitBackground: true })
    await page.close()
    console.log(png)
  }
} finally {
  await browser.close()
}
