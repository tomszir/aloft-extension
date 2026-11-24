// Stills of the real extension for the promo video in video/: one capture per
// state (each keystroke, each theme), which Remotion then animates between.
// Stills rather than a screen recording, so every frame is sharp at 1080p and
// the timing lives in the video, not in how fast the browser happened to be.
// Run with `pnpm video:frames`, which builds the e2e variant first.
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { FrameLocator, Page } from '@playwright/test'
import {
  type Crop,
  closeAloft,
  launchDemo,
  openAloft,
  paletteCrop,
  setSettings,
  settle,
  VIEWPORT,
} from './demo.ts'

const OUT = resolve('video/public/frames')
const CROP_MARGIN = 40

interface Scene {
  crop: Crop
  frames: string[]
}

const scenes: Record<string, Scene> = {}

// The scene's crop grows to fit every frame in it, so the card stays put while
// results appear under the input.
function union(a: Crop | undefined, b: Crop): Crop {
  if (!a) return b
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  }
}

async function capture(page: Page, scene: string, crop?: Crop) {
  const entry = scenes[scene] ?? { crop: { x: 0, y: 0, width: 0, height: 0 }, frames: [] }
  const name = `${scene}-${entry.frames.length}.jpg`
  await page.screenshot({
    path: join(OUT, name),
    type: 'jpeg',
    quality: 92,
    animations: 'disabled',
    caret: 'hide',
  })
  const box = crop ?? (await paletteCrop(page, CROP_MARGIN))
  scenes[scene] = {
    crop: entry.frames.length === 0 ? box : union(entry.crop, box),
    frames: [...entry.frames, name],
  }
  console.log(`video/public/frames/${name}`)
}

async function type(frame: FrameLocator, page: Page, scene: string, text: string, from = '') {
  for (let i = 1; i <= text.length; i++) {
    await frame.getByRole('combobox').fill(from + text.slice(0, i))
    await page.waitForTimeout(150)
    await capture(page, scene)
  }
}

const { worker, host, close } = await launchDemo()

try {
  await rm(OUT, { recursive: true, force: true })
  await mkdir(OUT, { recursive: true })

  // The page on its own first, then with Aloft over it; the open scene uses
  // the open palette's crop for both.
  await settle(host)
  await capture(host, 'open', { x: 0, y: 0, width: VIEWPORT.width, height: VIEWPORT.height })
  let frame = await openAloft(worker, host)
  await settle(host)
  await capture(host, 'open')
  const open = scenes.open
  if (open?.frames[1]) scenes.open = { ...open, crop: await paletteCrop(host, CROP_MARGIN) }

  await type(frame, host, 'search', 'keyboard')
  await frame.getByRole('combobox').press('ArrowDown')
  await host.waitForTimeout(150)
  await capture(host, 'search')

  await frame.getByRole('combobox').fill('')
  await frame.getByRole('combobox').fill('>')
  await host.waitForTimeout(150)
  await capture(host, 'actions')
  await type(frame, host, 'actions', 'pin')

  // The first Esc only leaves the actions chip.
  await frame.getByRole('combobox').dispatchEvent('keydown', { key: 'Escape', bubbles: true })
  await closeAloft(host)
  frame = await openAloft(worker, host)
  await settle(host)
  const themes = [
    { colorScheme: 'dark', darkTheme: 'helium-dark' },
    { colorScheme: 'dark', darkTheme: 'graphite' },
    { colorScheme: 'dark', darkTheme: 'moss' },
    { colorScheme: 'dark', darkTheme: 'dusk' },
    { colorScheme: 'light', lightTheme: 'helium-light' },
    { colorScheme: 'light', lightTheme: 'paper' },
  ]
  for (const appearance of themes) {
    // The open palette follows settings live, as it does on the settings page.
    await setSettings(worker, { appearance })
    await host.emulateMedia({ colorScheme: appearance.colorScheme === 'light' ? 'light' : 'dark' })
    await host.waitForTimeout(400)
    await capture(host, 'themes')
  }

  await writeFile(
    join(OUT, 'manifest.json'),
    `${JSON.stringify({ viewport: VIEWPORT, scenes }, null, 2)}\n`,
  )
  console.log('video/public/frames/manifest.json')
} finally {
  await close()
}
