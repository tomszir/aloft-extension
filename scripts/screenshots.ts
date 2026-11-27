// Store and README screenshots, taken from the real extension in a real
// browser so they never drift from the UI. Run with `pnpm screenshots`, which
// builds the e2e variant first. The release workflow runs it on the release
// PR, so the shots of every release match what it ships (docs/releasing.md).
import { mkdir, readFile, writeFile } from 'node:fs/promises'
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

interface Size {
  width: number
  height: number
}

interface Capture {
  shot: Buffer
  crop: Crop
  /** The capture's size in CSS pixels, which `crop` is within. */
  full: Size
}

interface Caption {
  title: string
  text: string
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Store screenshots compete with every other listing at thumbnail size, so
// the palette is scaled up and runs off the frame's bottom edge, under a
// headline, with the brand color around it.
const SCALE = 1.3
const SHOT_TOP = 250

// Inlined from the package rather than fetched, so the images come out the
// same on every machine and in CI.
const SORA = await readFile(
  resolve('node_modules/@fontsource-variable/sora/files/sora-latin-wght-normal.woff2'),
)
const LOGO = await readFile(resolve('assets/brand/logo.svg'), 'utf8')

const BACKGROUND = `
    radial-gradient(60% 55% at 50% 62%,rgba(47,111,235,.55) 0%,rgba(47,111,235,0) 70%),
    radial-gradient(45% 50% at 12% 8%,rgba(124,92,255,.35) 0%,rgba(124,92,255,0) 70%),
    radial-gradient(45% 50% at 90% 4%,rgba(56,189,248,.28) 0%,rgba(56,189,248,0) 70%),
    linear-gradient(180deg,#0B1230 0%,#0A1A45 100%)`

const base = (size: Size) => `
@font-face{font-family:Sora;src:url(data:font/woff2;base64,${SORA.toString('base64')}) format('woff2');font-weight:100 900}
html,body{margin:0;width:${size.width}px;height:${size.height}px;overflow:hidden}
body{position:relative;color:#fff;font-family:Sora,sans-serif;-webkit-font-smoothing:antialiased;background:${BACKGROUND}}
.logo svg{display:block;width:100%;height:100%}`

// The crop of a capture as a background, scaled by `scale`. It always runs
// off an edge of the image, so only its top left corner, or its top corners,
// are rounded.
const shotStyle = ({ shot, crop, full }: Capture, scale: number, radius: string) => {
  const px = (n: number) => `${Math.round(n * scale)}px`
  return `width:${px(crop.width)};height:${px(crop.height)};border-radius:${radius};
  background:url(data:image/png;base64,${shot.toString('base64')}) no-repeat;
  background-size:${px(full.width)} ${px(full.height)};
  background-position:-${px(crop.x)} -${px(crop.y)};
  box-shadow:0 40px 100px rgba(2,6,23,.7),0 0 0 1px rgba(255,255,255,.12)`
}

// A plain browser for laying out the framed images and comparing them with
// the ones already there; the extension's profile isn't needed for that.
const framer = await chromium.launch(
  executablePath ? { executablePath, headless: true } : { channel: 'chromium', headless: true },
)

// Rendering differs a little between machines and browser builds, which
// would otherwise rewrite every image on each run and make the store
// listing look changed when it isn't. A pixel counts as changed past this
// much on any channel, and an image as changed past this share of pixels:
// far below one changed word, far above antialiasing noise.
const CHANNEL_TOLERANCE = 48
const CHANGED_SHARE = 0.0001

async function differs(path: string, png: Buffer): Promise<boolean> {
  let old: Buffer
  try {
    old = await readFile(path)
  } catch {
    return true
  }
  if (old.equals(png)) return false
  const page = await framer.newPage()
  try {
    return await page.evaluate(
      async ({ before, after, tolerance, share }) => {
        const pixels = async (base64: string) => {
          const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob()
          const bitmap = await createImageBitmap(blob)
          const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
          const context = canvas.getContext('2d')
          if (!context) throw new Error('no 2d context')
          context.drawImage(bitmap, 0, 0)
          return context.getImageData(0, 0, bitmap.width, bitmap.height)
        }
        const [a, b] = await Promise.all([pixels(before), pixels(after)])
        if (a.width !== b.width || a.height !== b.height) return true
        let changed = 0
        for (let i = 0; i < a.data.length; i += 4) {
          for (let c = 0; c < 3; c++) {
            if (Math.abs((a.data[i + c] ?? 0) - (b.data[i + c] ?? 0)) > tolerance) {
              changed++
              break
            }
          }
        }
        return changed > a.width * a.height * share
      },
      {
        before: old.toString('base64'),
        after: png.toString('base64'),
        tolerance: CHANNEL_TOLERANCE,
        share: CHANGED_SHARE,
      },
    )
  } finally {
    await page.close()
  }
}

async function render(html: string, size: Size, name: string) {
  const page = await framer.newPage({ viewport: size, deviceScaleFactor: 1 })
  await page.setContent(html)
  await page.evaluate(() => document.fonts.ready)
  const png = await page.screenshot()
  await page.close()
  const path = join(OUT, name)
  if (await differs(path, png)) {
    await writeFile(path, png)
    console.log(`docs/screenshots/${name}: updated`)
  } else {
    console.log(`docs/screenshots/${name}: unchanged`)
  }
}

// Room under a capture that's shown whole.
const BOTTOM_MARGIN = 40

/**
 * One store screenshot: the logo, name and number, a headline and a line
 * under it, then the capture, which starts below them and runs off the
 * bottom edge. A `whole` capture is scaled down instead, if it has to be,
 * to fit above the bottom edge.
 */
async function frame(
  name: string,
  number: string,
  capture: Capture,
  caption: Caption,
  { whole = false } = {},
) {
  const scale = whole
    ? Math.min(SCALE, (VIEWPORT.height - SHOT_TOP - BOTTOM_MARGIN) / capture.crop.height)
    : SCALE
  const width = Math.round(capture.crop.width * scale)
  const left = Math.round((VIEWPORT.width - width) / 2)
  // Low enough that even a short capture runs off the bottom edge.
  const top = whole
    ? SHOT_TOP
    : Math.max(SHOT_TOP, VIEWPORT.height - capture.crop.height * scale + 24)
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${base(VIEWPORT)}
.head{position:absolute;top:52px;left:${left}px;right:${left}px}
.brand{display:flex;align-items:center;gap:12px;font-weight:600;font-size:17px}
.brand .logo{width:32px;height:32px;filter:drop-shadow(0 8px 20px rgba(47,111,235,.45))}
.brand span:last-child{color:#C9D6F5;font-weight:400;font-variant-numeric:tabular-nums}
h1{margin:36px 0 0;font-weight:650;font-size:46px;line-height:1.08;letter-spacing:-.03em}
p{margin:14px 0 0;font-weight:400;font-size:20px;line-height:1.4;color:#C9D6F5}
.shot{position:absolute;top:${Math.round(top)}px;left:${left}px;${shotStyle(capture, scale, whole ? '20px' : '20px 20px 0 0')}}
</style></head><body>
<div class="head">
  <div class="brand"><span class="logo">${LOGO}</span><span>Aloft</span><span>${number}</span></div>
  <h1>${escapeHtml(caption.title)}</h1>
  <p>${escapeHtml(caption.text)}</p>
</div>
<div class="shot"></div>
</body></html>`
  await render(html, VIEWPORT, `${name}.png`)
}

// The store's optional marquee tile: the name on the left, the palette
// running off the right and bottom edges.
const MARQUEE = { width: 1400, height: 560 }

async function marquee(capture: Capture) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${base(MARQUEE)}
.brand{position:absolute;left:88px;top:0;bottom:0;width:520px;display:flex;flex-direction:column;justify-content:center;gap:22px}
.brand .logo{width:72px;height:72px;filter:drop-shadow(0 12px 30px rgba(47,111,235,.5))}
h1{margin:0;font-weight:700;font-size:88px;line-height:1;letter-spacing:-.04em}
p{margin:0;font-size:26px;line-height:1.35;color:#C9D6F5}
.shot{position:absolute;left:660px;top:72px;${shotStyle(capture, 1.2, '20px 0 0 0')}}
</style></head><body>
<div class="brand"><span class="logo">${LOGO}</span><h1>Aloft</h1><p>A floating command bar for your tabs, history and bookmarks</p></div>
<div class="shot"></div>
</body></html>`
  await render(html, MARQUEE, 'marquee-1400x560.png')
}

// The palette's panel alone: the brand background around it already says
// it floats, and a page behind it would only compete at thumbnail size.
async function palette(host: Page): Promise<Capture> {
  const crop = await paletteCrop(host, 0)
  // The whole page, cropped later: a clipped screenshot at 2x cuts the
  // overlay's frame off partway down.
  const shot = await host.screenshot({ animations: 'disabled', caret: 'hide' })
  return { shot, crop, full: VIEWPORT }
}

/**
 * The top of the settings page's Appearance section: its heading, then the
 * color scheme and theme choices, with `margin` of the page around them and
 * at least `minHeight` tall, so the frame's bottom edge cuts it off.
 */
async function appearance(margin: number, minHeight: number): Promise<Capture> {
  const page = await context.newPage()
  await page.goto(new URL('/options.html', worker.url()).href)
  const section = page.locator('#appearance')
  await section.evaluate((el) => el.scrollIntoView({ block: 'start' }))
  await settle(page)
  const rect = await section.evaluate((el) => {
    const top = el.getBoundingClientRect()
    const group = el.children[1]?.getBoundingClientRect() ?? top
    return { x: top.x, y: top.y, width: top.width, height: group.bottom - top.y }
  })
  const clip = {
    x: rect.x - margin,
    y: rect.y - margin,
    width: rect.width + 2 * margin,
    height: Math.max(rect.height + 2 * margin, minHeight),
  }
  const shot = await page.screenshot({ clip, animations: 'disabled', caret: 'hide' })
  await page.close()
  const full = { width: clip.width, height: clip.height }
  return { shot, crop: { x: 0, y: 0, ...full }, full }
}

const { context, worker, host, close } = await launchDemo()

try {
  await mkdir(OUT, { recursive: true })

  let aloft = await openAloft(worker, host)
  await settle(host)
  const first = await palette(host)
  await frame(
    '1-pinned-and-tabs',
    '01',
    first,
    {
      title: 'Your tabs, one keystroke away',
      text: 'Alt+Q opens Aloft over the page you’re on. Pinned tabs are Alt+1 to 9.',
    },
    // The first look at Aloft, so all of it, down to the hints at its foot.
    { whole: true },
  )
  await marquee(first)

  await aloft.getByRole('combobox').fill('e')
  await settle(host)
  await frame('2-search', '02', await palette(host), {
    title: 'Everything in one search',
    text: 'Tabs, history and bookmarks, ranked together, with what matched marked.',
  })

  await aloft.getByRole('combobox').fill('>')
  await settle(host)
  await frame('3-actions', '03', await palette(host), {
    title: 'Type > to act on the tab',
    text: 'Pin, duplicate, move or close tabs, or open the browser’s own pages.',
  })

  // The first Esc only leaves the actions chip.
  await aloft.getByRole('combobox').dispatchEvent('keydown', { key: 'Escape', bubbles: true })
  await closeAloft(host)
  // In light, so the set shows both schemes.
  await setSettings(worker, { appearance: { colorScheme: 'light' } })
  await host.emulateMedia({ colorScheme: 'light' })
  aloft = await openAloft(worker, host)
  await aloft.getByRole('combobox').pressSequentially('@')
  await settle(host)
  await frame('4-keywords', '04', await palette(host), {
    title: 'Search a site from the bar',
    text: 'Type a keyword like yt and a space, or @ to see them all. Add your own.',
  })

  await closeAloft(host)
  await setSettings(worker, { appearance: { colorScheme: 'dark' } })
  await host.emulateMedia({ colorScheme: 'dark' })
  await frame('5-themes', '05', await appearance(24, (VIEWPORT.height - SHOT_TOP) / SCALE + 8), {
    title: 'Light, dark, or your own theme',
    text: 'Colors, corners, font and density, previewed live as you change them.',
  })
} finally {
  await framer.close()
  await close()
}
