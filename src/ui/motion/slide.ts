/**
 * Slides a highlight drawn on `to`'s ::before from where `from`'s was, so a
 * selection moves rather than jumps: the palette's rows, segmented choices,
 * the settings menu. Nothing moves with reduced motion or no duration.
 */
export function slideHighlight(from: Element, to: Element, durationToken: string): void {
  if (from === to || typeof to.animate !== 'function') return
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  // Tokens live on :root, where themes set them too.
  const style = getComputedStyle(document.documentElement)
  const duration = Number.parseFloat(style.getPropertyValue(durationToken))
  if (!(duration > 0)) return
  const a = from.getBoundingClientRect()
  const b = to.getBoundingClientRect()
  // Moved and resized from the old box, the corner held at the top left. A
  // box with no size yet isn't resized.
  const scale = (old: number, now: number) => (now > 0 ? old / now : 1)
  const transform = `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${scale(a.width, b.width)}, ${scale(a.height, b.height)})`
  to.animate(
    [
      { transform, transformOrigin: '0 0' },
      { transform: 'none', transformOrigin: '0 0' },
    ],
    {
      duration,
      easing: style.getPropertyValue('--al-ease-out').trim() || 'ease-out',
      pseudoElement: '::before',
    },
  )
}
