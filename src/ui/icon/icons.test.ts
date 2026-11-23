import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ICON_NAMES, iconBody } from './icons'

const lock = JSON.parse(readFileSync('vendor/icons.lock.json', 'utf8')) as { icons: string[] }

describe('vendored icons', () => {
  it('lists exactly the icons in the lock', () => {
    expect([...ICON_NAMES].sort()).toEqual([...lock.icons].sort())
  })

  it.each(ICON_NAMES)('%s is vendored with the normalised root', (name) => {
    expect(iconBody(name)).toMatch(/^<(path|circle|rect|line|polyline|polygon)\b/)
  })

  it('carries no script or event handlers', () => {
    for (const name of ICON_NAMES) expect(iconBody(name)).not.toMatch(/<script|\son\w+=/i)
  })
})
