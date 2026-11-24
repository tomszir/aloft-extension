import { describe, expect, it } from 'vitest'
import { iconTone } from './icon-tone'

const icon = (...pixels: [number, number, number, number, number][]) =>
  pixels.flatMap(([r, g, b, a, count]) => Array.from({ length: count }, () => [r, g, b, a]).flat())

describe('iconTone', () => {
  it('finds an all-black icon on a transparent background', () => {
    expect(iconTone(icon([0, 0, 0, 255, 40], [0, 0, 0, 0, 200]))).toBe('dark')
  })

  it('finds an all-white icon', () => {
    expect(iconTone(icon([255, 255, 255, 255, 50], [240, 240, 240, 255, 5]))).toBe('light')
  })

  it('leaves coloured and mixed icons alone', () => {
    expect(iconTone(icon([255, 0, 0, 255, 60]))).toBeUndefined()
    expect(iconTone(icon([0, 0, 0, 255, 50], [255, 255, 255, 255, 50]))).toBeUndefined()
    expect(iconTone([])).toBeUndefined()
  })
})
