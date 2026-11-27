import { afterEach, describe, expect, it, vi } from 'vitest'
import { slideHighlight } from './slide'

const box = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height }) as DOMRect

describe('slideHighlight', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty('--al-duration-move')
  })

  it("animates the new highlight from the old one's place and size", () => {
    document.documentElement.style.setProperty('--al-duration-move', '200ms')
    const from = document.createElement('div')
    const to = document.createElement('div')
    from.getBoundingClientRect = () => box(0, 0, 50, 20)
    to.getBoundingClientRect = () => box(100, 0, 100, 20)
    const animate = vi.fn()
    to.animate = animate
    slideHighlight(from, to, '--al-duration-move')
    expect(animate).toHaveBeenCalledOnce()
    const [frames, options] = animate.mock.calls[0] ?? []
    expect(frames[0].transform).toBe('translate(-100px, 0px) scale(0.5, 1)')
    expect(options).toMatchObject({ duration: 200, pseudoElement: '::before' })
  })

  it('stays still without a duration', () => {
    const from = document.createElement('div')
    const to = document.createElement('div')
    const animate = vi.fn()
    to.animate = animate
    slideHighlight(from, to, '--al-duration-move')
    expect(animate).not.toHaveBeenCalled()
  })
})
