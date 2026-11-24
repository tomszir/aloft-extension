import { describe, expect, it } from 'vitest'
import { brandColor } from './color'

const icon = (...pixels: [number, number, number, number, number][]) =>
  pixels.flatMap(([r, g, b, a, count]) => Array.from({ length: count }, () => [r, g, b, a]).flat())

describe('brandColor', () => {
  it('picks the colour most of a red icon is', () => {
    expect(brandColor(icon([255, 0, 0, 255, 60], [255, 255, 255, 255, 40]))).toBe('#ff0000')
  })

  it('ignores transparent, white, black and grey pixels', () => {
    expect(
      brandColor(icon([0, 0, 255, 0, 500], [20, 20, 20, 255, 50], [0, 120, 255, 255, 30])),
    ).toBe('#0078ff')
  })

  it('is null for a monochrome icon or one with only a speck of colour', () => {
    expect(brandColor(icon([24, 23, 23, 255, 80], [250, 250, 250, 255, 20]))).toBeNull()
    expect(brandColor(icon([30, 30, 30, 255, 95], [255, 0, 0, 255, 5]))).toBeNull()
    expect(brandColor([])).toBeNull()
  })
})
