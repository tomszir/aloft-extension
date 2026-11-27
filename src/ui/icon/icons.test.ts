import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ICON_NAMES, iconBody, PALETTE_ICON_NAMES } from './icons'
import './page-icons'

const lock = JSON.parse(readFileSync('vendor/icons.lock.json', 'utf8')) as { icons: string[] }

describe('vendored icons', () => {
  it('lists exactly the icons in the lock', () => {
    expect([...ICON_NAMES].sort()).toEqual([...lock.icons].sort())
  })

  it.each(ICON_NAMES)('%s is vendored with the normalised root', (name) => {
    expect(iconBody(name)).toMatch(/^<(path|circle|rect|line|polyline|polygon)\b/)
  })

  it('bundles with the palette only the icons it draws', async () => {
    const palette = await import('./icons')
    expect(palette.PALETTE_ICON_NAMES).toEqual(PALETTE_ICON_NAMES)
    expect(PALETTE_ICON_NAMES).toContain('search')
    expect(PALETTE_ICON_NAMES).not.toContain('palette')
  })

  it('carries no script or event handlers', () => {
    for (const name of ICON_NAMES) expect(iconBody(name)).not.toMatch(/<script|\son\w+=/i)
  })
})
