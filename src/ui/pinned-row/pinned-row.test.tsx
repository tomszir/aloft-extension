import { fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TabEntry } from '../../core/results'
import { PinnedRow, type PinnedRowProps } from './pinned-row'

const pin = (tabId: number, title: string): TabEntry => ({
  tabId,
  windowId: 1,
  index: tabId,
  pinned: true,
  loaded: true,
  title,
  url: `https://t.test/${title}`,
  lastAccessed: 0,
})

const pins = [pin(0, 'Mail'), pin(1, 'Calendar'), pin(2, 'Music')]
const CELL = 100

// happy-dom has no layout, so tiles get one 90 px cell each in a single row,
// placed by their position among the tiles.
function fakeLayout() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const tiles = Array.from(document.querySelectorAll('[data-pin-tile]'))
    const index = tiles.indexOf(this)
    const x = index === -1 ? 0 : index * CELL
    const width = index === -1 ? CELL * tiles.length : 90
    return DOMRect.fromRect({ x, y: 0, width, height: 44 })
  })
}

function renderRow(overrides: Partial<PinnedRowProps> = {}) {
  const props: PinnedRowProps = {
    pins,
    altHeld: false,
    favicon: async () => null,
    onOpen: vi.fn(),
    onMenu: vi.fn(),
    onReorder: vi.fn(),
    ...overrides,
  }
  render(() => <PinnedRow {...props} />)
  return props
}

function drag(name: string, toX: number) {
  const tile = screen.getByRole('button', { name })
  fireEvent.pointerDown(tile, { button: 0, pointerId: 1, clientX: 45, clientY: 20 })
  fireEvent.pointerMove(tile, { pointerId: 1, clientX: 60, clientY: 20 })
  fireEvent.pointerMove(tile, { pointerId: 1, clientX: toX, clientY: 20 })
  return tile
}

describe('PinnedRow dragging', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame'] })
    fakeLayout()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('moves a dropped pin to the cell under it, without opening it', () => {
    const props = renderRow()
    const mail = drag('Mail', 245)
    fireEvent.pointerUp(mail, { pointerId: 1 })
    fireEvent.click(mail)
    vi.advanceTimersByTime(500)

    expect(props.onReorder).toHaveBeenCalledWith(pins[0], 2)
    expect(props.onOpen).not.toHaveBeenCalled()
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))
    expect(names).toEqual(['Calendar', 'Music', 'Mail'])
  })

  it('slides the other pins aside while dragging and marks the lifted one', () => {
    renderRow()
    const mail = drag('Mail', 245)
    expect(mail.hasAttribute('data-lifted')).toBe(true)
    expect(screen.getByRole('button', { name: 'Calendar' }).style.transform).toBe(
      `translate(${-CELL}px, 0px)`,
    )
  })

  it('a press that barely moves is still a click', () => {
    const props = renderRow()
    const mail = screen.getByRole('button', { name: 'Mail' })
    fireEvent.pointerDown(mail, { button: 0, pointerId: 1, clientX: 45, clientY: 20 })
    fireEvent.pointerMove(mail, { pointerId: 1, clientX: 47, clientY: 21 })
    fireEvent.pointerUp(mail, { pointerId: 1 })
    fireEvent.click(mail)
    expect(props.onOpen).toHaveBeenCalledWith(pins[0])
    expect(mail.hasAttribute('data-lifted')).toBe(false)
  })

  it('Esc puts the pin back and stops the key reaching the palette', () => {
    const props = renderRow()
    const onKey = vi.fn()
    window.addEventListener('keydown', onKey)
    const mail = drag('Mail', 245)
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.pointerUp(mail, { pointerId: 1 })
    vi.advanceTimersByTime(500)
    window.removeEventListener('keydown', onKey)

    expect(onKey).not.toHaveBeenCalled()
    expect(props.onReorder).not.toHaveBeenCalled()
  })

  it("doesn't drag when the row can't be reordered", () => {
    renderRow({ onReorder: undefined })
    const mail = drag('Mail', 245)
    expect(mail.hasAttribute('data-lifted')).toBe(false)
  })
})
