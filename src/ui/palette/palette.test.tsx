import { fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import type { Section, TabEntry } from '../../core/results'
import { Palette, type PaletteProps } from './palette'

const pin = (tabId: number, title: string, loaded = true): TabEntry => ({
  tabId,
  windowId: 1,
  index: tabId,
  pinned: true,
  loaded,
  title,
  url: `https://${title.toLowerCase()}.test/`,
  lastAccessed: 0,
})
const pins = [pin(10, 'Mail'), pin(11, 'Calendar', false), pin(12, 'Music')]

const sections: Section[] = [
  { id: 'top', results: [{ kind: 'search', id: 'search', query: 'aloft' }] },
  {
    id: 'tabs',
    results: [
      {
        kind: 'tab',
        id: 'tab:2',
        tabId: 2,
        windowId: 1,
        title: 'Aloft repo',
        url: 'https://a.test',
      },
    ],
  },
]

const baseProps = (): PaletteProps => ({
  position: 'upper-third',
  query: 'aloft',
  sections,
  activeId: 'search',
  favicon: () => '',
  onQuery: vi.fn(),
  onMove: vi.fn(),
  onHover: vi.fn(),
  onActivate: vi.fn(),
  onClose: vi.fn(),
  pins: [],
  pinShortcuts: [],
  onOpenPin: vi.fn(),
  onMovePin: vi.fn(),
  onUnpin: vi.fn(),
})

function renderPalette(overrides: Partial<PaletteProps> = {}) {
  const props = { ...baseProps(), ...overrides }
  render(() => <Palette {...props} />)
  return props
}

describe('Palette', () => {
  it('focuses the input as a combobox wired to the results', () => {
    renderPalette()
    const input = screen.getByRole('combobox')
    expect(document.activeElement).toBe(input)
    expect(input.getAttribute('aria-controls')).toBe(screen.getByRole('listbox').id)
    expect(input.getAttribute('aria-expanded')).toBe('true')
  })

  it('points aria-activedescendant at the active option', () => {
    const [activeId, setActiveId] = createSignal('search')
    const base = baseProps()
    render(() => <Palette {...base} activeId={activeId()} />)
    const input = screen.getByRole('combobox')
    const options = screen.getAllByRole('option')
    expect(input.getAttribute('aria-activedescendant')).toBe(options[0]?.id)
    expect(options[0]?.getAttribute('aria-selected')).toBe('true')

    setActiveId('tab:2')
    expect(input.getAttribute('aria-activedescendant')).toBe(options[1]?.id)
    expect(options[0]?.getAttribute('aria-selected')).toBe('false')
  })

  it('groups options under labelled sections', () => {
    renderPalette()
    expect(screen.getByRole('group', { name: 'sectionOpenTabs' })).toBeTruthy()
  })

  it('moves with the arrow keys and Page Up/Down', () => {
    const props = renderPalette()
    const input = screen.getByRole('combobox')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.keyDown(input, { key: 'PageDown' })
    fireEvent.keyDown(input, { key: 'PageUp' })
    expect(props.onMove).toHaveBeenNthCalledWith(1, 'next')
    expect(props.onMove).toHaveBeenNthCalledWith(2, 'previous')
    expect(props.onMove).toHaveBeenNthCalledWith(3, 'last')
    expect(props.onMove).toHaveBeenNthCalledWith(4, 'first')
  })

  it('opens the active result with Enter, and passes Shift through', () => {
    const props = renderPalette({ activeId: 'tab:2' })
    const input = screen.getByRole('combobox')
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(props.onActivate).toHaveBeenNthCalledWith(1, sections[1]?.results[0], false)
    expect(props.onActivate).toHaveBeenNthCalledWith(2, sections[1]?.results[0], true)
  })

  it('ignores Enter while an IME is composing', () => {
    const props = renderPalette()
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter', isComposing: true })
    expect(props.onActivate).not.toHaveBeenCalled()
  })

  it('opens a result on click without moving focus out of the input', () => {
    const props = renderPalette()
    const option = screen.getAllByRole('option')[1]
    if (!option) throw new Error('missing option')
    const mouseDown = fireEvent.mouseDown(option)
    fireEvent.click(option, { shiftKey: true })
    expect(mouseDown).toBe(false)
    expect(props.onActivate).toHaveBeenCalledWith(sections[1]?.results[0], true)
  })

  it('closes on Escape and on a backdrop click, but not on a panel click', () => {
    const props = renderPalette()
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' })
    fireEvent.click(screen.getByRole('dialog'))
    expect(props.onClose).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'hintClose' }))
    expect(props.onClose).toHaveBeenCalledTimes(2)
  })

  it('keeps the backdrop out of the tab order', () => {
    renderPalette()
    expect(screen.getByRole('button', { name: 'hintClose' }).tabIndex).toBe(-1)
  })

  it('hides the results list and collapses the combobox when there is nothing to show', () => {
    renderPalette({ sections: [], activeId: undefined })
    expect(screen.getByRole('combobox').getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByRole('combobox').hasAttribute('aria-activedescendant')).toBe(false)
  })
  describe('pinned row', () => {
    it('shows each pin as a button with its Alt shortcut', () => {
      renderPalette({ pins, pinShortcuts: pins })
      const tiles = screen.getAllByRole('button', { name: /Mail|Calendar|Music/ })
      expect(tiles.map((t) => t.getAttribute('aria-keyshortcuts'))).toEqual([
        'Alt+1',
        'Alt+2',
        'Alt+3',
      ])
    })

    it('shows number badges only while Alt is held', () => {
      renderPalette({ pins, pinShortcuts: pins })
      const mail = screen.getByRole('button', { name: 'Mail' })
      expect(mail.textContent).not.toContain('1')
      fireEvent.keyDown(window, { key: 'Alt', altKey: true })
      expect(mail.textContent).toContain('1')
      fireEvent.keyUp(window, { key: 'Alt', altKey: false })
      expect(mail.textContent).not.toContain('1')
    })

    it('opens a pin with Alt+digit by physical key, even when the row is hidden', () => {
      const props = renderPalette({ pins: [], pinShortcuts: pins })
      // Option+2 types "™" on a Mac; the physical key is what counts.
      fireEvent.keyDown(screen.getByRole('combobox'), { key: '™', code: 'Digit2', altKey: true })
      expect(props.onOpenPin).toHaveBeenCalledWith(pins[1])
      expect(props.onActivate).not.toHaveBeenCalled()
    })

    it('ignores Alt+digit with no pin in that slot', () => {
      const props = renderPalette({ pins, pinShortcuts: pins })
      fireEvent.keyDown(screen.getByRole('combobox'), { key: '7', code: 'Digit7', altKey: true })
      expect(props.onOpenPin).not.toHaveBeenCalled()
    })

    it('Enter on a focused tile opens that pin, not the selected result', () => {
      const props = renderPalette({ pins, pinShortcuts: pins })
      const music = screen.getByRole('button', { name: 'Music' })
      music.focus()
      fireEvent.keyDown(music, { key: 'Enter' })
      expect(props.onActivate).not.toHaveBeenCalled()
    })

    it('offers move and unpin from the context menu, with the ends disabled', () => {
      const props = renderPalette({ pins, pinShortcuts: pins })
      fireEvent.contextMenu(screen.getByRole('button', { name: 'Mail' }))
      const menu = screen.getByRole('menu')
      const item = (name: string) => screen.getByRole('menuitem', { name }) as HTMLButtonElement
      expect(menu).toBeTruthy()
      expect(item('menuMoveLeft').disabled).toBe(true)
      expect(item('menuMoveRight').disabled).toBe(false)
      expect(document.activeElement).toBe(item('menuOpen'))

      fireEvent.click(item('menuUnpin'))
      expect(props.onUnpin).toHaveBeenCalledWith(pins[0])
      expect(screen.queryByRole('menu')).toBeNull()
      expect(document.activeElement).toBe(screen.getByRole('combobox'))
    })

    it('Escape in the menu closes only the menu', () => {
      const props = renderPalette({ pins, pinShortcuts: pins })
      fireEvent.keyDown(screen.getByRole('button', { name: 'Music' }), { key: 'ContextMenu' })
      fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
      expect(screen.queryByRole('menu')).toBeNull()
      expect(props.onClose).not.toHaveBeenCalled()
    })
  })
})
