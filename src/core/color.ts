/**
 * The colour an icon is known by, from its RGBA pixels: the most common hue
 * among strongly coloured pixels, averaged. Null when the icon is mostly
 * white, black or grey, like GitHub's, so the theme's accent is kept instead.
 */
export function brandColor(pixels: ArrayLike<number>): string | null {
  const buckets = new Map<number, { r: number; g: number; b: number; count: number }>()
  let opaque = 0
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const r = pixels[i] ?? 0
    const g = pixels[i + 1] ?? 0
    const b = pixels[i + 2] ?? 0
    const a = pixels[i + 3] ?? 0
    if (a < 128) continue
    opaque++
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const lightness = (max + min) / 510
    const saturation = max === 0 ? 0 : (max - min) / max
    if (saturation < 0.35 || lightness < 0.12 || lightness > 0.92) continue
    // 12 hue slices are enough to tell red from orange without splitting one
    // brand colour's antialiased edge into its own bucket.
    const hue = hueOf(r, g, b, max, min)
    const key = Math.round(hue / 30) % 12
    const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, count: 0 }
    bucket.r += r
    bucket.g += g
    bucket.b += b
    bucket.count++
    buckets.set(key, bucket)
  }
  let best: { r: number; g: number; b: number; count: number } | undefined
  for (const bucket of buckets.values()) if (!best || bucket.count > best.count) best = bucket
  // A few coloured pixels on a mostly grey icon don't make it a colourful one.
  if (!best || best.count < opaque * 0.15) return null
  const hex = (sum: number) =>
    Math.round(sum / (best?.count ?? 1))
      .toString(16)
      .padStart(2, '0')
  return `#${hex(best.r)}${hex(best.g)}${hex(best.b)}`
}

function hueOf(r: number, g: number, b: number, max: number, min: number): number {
  const d = max - min
  if (d === 0) return 0
  let h: number
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return (h * 60 + 360) % 360
}
