export type IconTone = 'dark' | 'light'

// Share of an icon's visible pixels that must be near black or near white
// for it to count as that tone: one with a dark outline and a coloured fill
// shows up fine on any tile.
const MOSTLY = 0.85

/**
 * Whether an icon is all but black or all but white, from its RGBA pixels,
 * so a tile can give it a backing it shows up on. Undefined for anything with
 * real colour or contrast of its own.
 */
export function iconTone(pixels: ArrayLike<number>): IconTone | undefined {
  let opaque = 0
  let dark = 0
  let light = 0
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if ((pixels[i + 3] ?? 0) < 128) continue
    opaque++
    const luminance =
      (0.2126 * (pixels[i] ?? 0) + 0.7152 * (pixels[i + 1] ?? 0) + 0.0722 * (pixels[i + 2] ?? 0)) /
      255
    if (luminance < 0.2) dark++
    else if (luminance > 0.85) light++
  }
  if (opaque === 0) return undefined
  if (dark / opaque >= MOSTLY) return 'dark'
  if (light / opaque >= MOSTLY) return 'light'
  return undefined
}
