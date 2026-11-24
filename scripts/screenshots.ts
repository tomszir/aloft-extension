// Store and README screenshots, taken from the real extension in a real
// browser so they never drift from the UI. Run with `pnpm screenshots`, which
// builds the e2e variant first.
import { mkdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { chromium, type Page } from '@playwright/test'
import {
  type Crop,
  closeAloft,
  executablePath,
  launchDemo,
  openAloft,
  paletteCrop,
  setSettings,
  settle,
  VIEWPORT,
} from './demo.ts'

const OUT = resolve('docs/screenshots')
// How much of the dimmed page shows around the palette, so it still reads as
// floating over a page.
const CROP_MARGIN = 40

interface Caption {
  title: string
  text: string
}

async function shoot(page: Page, name: string, caption: Caption) {
  const crop = await paletteCrop(page, CROP_MARGIN)
  // The whole page, cropped later: a clipped screenshot at 2x cuts the
  // overlay's frame off partway down.
  const shot = await page.screenshot({ animations: 'disabled', caret: 'hide' })
  await frame(shot, crop, caption, join(OUT, `${name}.png`))
  console.log(`docs/screenshots/${name}.png`)
  return { shot, crop }
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Store screenshots compete with every other listing at thumbnail size, so
// the palette is scaled up past the frame's bottom edge, with a headline and
// the brand color around it.
const SCALE = 1.3
const SHOT_TOP = 238

// Inlined from the package rather than fetched, so the images come out the
// same on every machine and in CI.
const SORA = await readFile(
  resolve('node_modules/@fontsource-variable/sora/files/sora-latin-wght-normal.woff2'),
)

const BACKGROUND = `
    radial-gradient(60% 55% at 50% 62%,rgba(47,111,235,.55) 0%,rgba(47,111,235,0) 70%),
    radial-gradient(45% 50% at 12% 8%,rgba(124,92,255,.35) 0%,rgba(124,92,255,0) 70%),
    radial-gradient(45% 50% at 90% 4%,rgba(56,189,248,.28) 0%,rgba(56,189,248,0) 70%),
    linear-gradient(180deg,#0B1230 0%,#0A1A45 100%)`

// The background-image crop of a full-page capture, scaled by `scale`.
const shotStyle = (shot: Buffer, crop: Crop, scale: number) => {
  const px = (n: number) => `${Math.round(n * scale)}px`
  return `width:${px(crop.width)};height:${px(crop.height)};border-radius:20px;
  background:url(data:image/png;base64,${shot.toString('base64')}) no-repeat;
  background-size:${px(VIEWPORT.width)} ${px(VIEWPORT.height)};
  background-position:-${px(crop.x)} -${px(crop.y)};
  box-shadow:0 40px 100px rgba(2,6,23,.7),0 0 0 1px rgba(255,255,255,.12)`
}

async function frame(shot: Buffer, crop: Crop, caption: Caption, path: string) {
  const logo = await readFile(resolve('assets/brand/logo.svg'), 'utf8')
  const page = await framer.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 })
  // Tall palettes run off the bottom edge; short ones sit in the middle of
  // the space under the headline instead of leaving it empty below.
  const room = VIEWPORT.height - SHOT_TOP
  const top = SHOT_TOP + Math.max(0, (room - crop.height * SCALE) / 2)
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Sora;src:url(data:font/woff2;base64,${SORA.toString('base64')}) format('woff2');font-weight:100 900}
html,body{margin:0;width:${VIEWPORT.width}px;height:${VIEWPORT.height}px;overflow:hidden}
body{position:relative;color:#fff;font-family:Sora,sans-serif;-webkit-font-smoothing:antialiased;
  background:${BACKGROUND}}
header{position:absolute;top:32px;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center}
header svg{width:64px;height:64px;margin-bottom:6px;filter:drop-shadow(0 10px 24px rgba(47,111,235,.45))}
h1{margin:0;font-weight:650;font-size:42px;line-height:1.1;letter-spacing:-.03em}
p{margin:0;font-weight:400;font-size:19px;line-height:1.4;color:#C9D6F5}
.shot{position:absolute;top:${Math.round(top)}px;left:50%;transform:translateX(-50%);
  ${shotStyle(shot, crop, SCALE)}}
</style></head><body>
<header>${logo}<h1>${escapeHtml(caption.title)}</h1><p>${escapeHtml(caption.text)}</p></header>
<div class="shot"></div>
</body></html>`)
  await page.screenshot({ path })
  await page.close()
}

// A plain browser for laying out the framed images; the extension's profile
// isn't needed for that.
const framer = await chromium.launch(
  executablePath ? { executablePath, headless: true } : { channel: 'chromium', headless: true },
)

// The store's optional marquee tile: the name on the left, centered on the
// visible part of the palette, which runs off the right and bottom edges.
const MARQUEE = { width: 1400, height: 560 }

async function marquee(shot: Buffer, crop: Crop, path: string) {
  const logo = await readFile(resolve('assets/brand/logo.svg'), 'utf8')
  const page = await framer.newPage({ viewport: MARQUEE, deviceScaleFactor: 1 })
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Sora;src:url(data:font/woff2;base64,${SORA.toString('base64')}) format('woff2');font-weight:100 900}
html,body{margin:0;width:${MARQUEE.width}px;height:${MARQUEE.height}px;overflow:hidden}
body{position:relative;color:#fff;font-family:Sora,sans-serif;-webkit-font-smoothing:antialiased;background:${BACKGROUND}}
.brand{position:absolute;left:0;width:680px;top:64px;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;text-align:center}
.brand svg{width:88px;height:88px;filter:drop-shadow(0 12px 30px rgba(47,111,235,.5))}
h1{margin:0;font-weight:700;font-size:76px;line-height:1;letter-spacing:-.04em}
p{margin:0;max-width:480px;font-size:26px;line-height:1.35;color:#C9D6F5}
.shot{position:absolute;left:680px;top:64px;${shotStyle(shot, crop, 1.2)}}
</style></head><body>
<div class="brand">${logo}<h1>Aloft</h1><p>A floating command bar for Helium and every Chromium browser</p></div>
<div class="shot"></div>
</body></html>`)
  await page.screenshot({ path })
  await page.close()
}

const { worker, host, close } = await launchDemo()

try {
  await mkdir(OUT, { recursive: true })

  let frame = await openAloft(worker, host)
  await settle(host)
  const first = await shoot(host, '1-pinned-and-tabs', {
    title: 'Your tabs, one keystroke away',
    text: 'Alt+Q or Ctrl+T opens Aloft over the page you’re on. Pins are Alt+1–9.',
  })
  await marquee(first.shot, first.crop, join(OUT, 'marquee-1400x560.png'))
  console.log('docs/screenshots/marquee-1400x560.png')

  await frame.getByRole('combobox').fill('keyboard')
  await settle(host)
  await shoot(host, '2-search', {
    title: 'Tabs, history and bookmarks in one search',
    text: 'The best match is first, and what matched is marked.',
  })

  await frame.getByRole('combobox').fill('>')
  await settle(host)
  await shoot(host, '3-actions', {
    title: 'Type > to act on the tab',
    text: 'Pin, duplicate, move or close tabs without reaching for the mouse.',
  })

  // The first Esc only leaves the actions chip.
  await frame.getByRole('combobox').dispatchEvent('keydown', { key: 'Escape', bubbles: true })
  await closeAloft(host)
  await setSettings(worker, { appearance: { colorScheme: 'light' } })
  await host.emulateMedia({ colorScheme: 'light' })
  frame = await openAloft(worker, host)
  await frame.getByRole('combobox').fill('trip')
  await settle(host)
  await shoot(host, '4-light', {
    title: 'Light, dark or your system’s',
    text: 'Aloft follows your color scheme, or keeps the one you pick.',
  })

  await closeAloft(host)
  await setSettings(worker, { appearance: { colorScheme: 'dark', darkTheme: 'moss' } })
  await host.emulateMedia({ colorScheme: 'dark' })
  frame = await openAloft(worker, host)
  await frame.getByRole('combobox').fill('handbook')
  await settle(host)
  await shoot(host, '5-themes', {
    title: 'Themes that suit your browser',
    text: 'Six built in, previewed live on the settings page.',
  })
} finally {
  await framer.close()
  await close()
}
