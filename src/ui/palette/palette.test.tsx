import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { builtInKeyword } from '../../core/keywords'
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
  chip: null,
  sections,
  activeId: 'search',
  favicon: () => Promise.resolve(null),
  onQuery: vi.fn(),
  onLeaveChip: vi.fn(),
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

  describe('the selection', () => {
    const animate = vi.fn()
    beforeEach(() => {
      animate.mockClear()
      HTMLElement.prototype.animate = animate
      document.documentElement.style.setProperty('--al-duration-select', '90ms')
    })
    afterEach(() => {
      // @ts-expect-error happy-dom has no Web Animations to put back.
      delete HTMLElement.prototype.animate
      document.documentElement.style.removeProperty('--al-duration-select')
    })

    it('slides from the row it was on when moving through the same results', () => {
      const [activeId, setActiveId] = createSignal('search')
      const base = baseProps()
      render(() => <Palette {...base} activeId={activeId()} />)
      setActiveId('tab:2')
      expect(animate).toHaveBeenCalledOnce()
      expect(animate.mock.calls[0]?.[1]).toMatchObject({ pseudoElement: '::before' })
    })

    it('just appears on the new row when the results change', () => {
      const [state, setState] = createSignal({ query: 'aloft', activeId: 'search' })
      const base = baseProps()
      render(() => <Palette {...base} query={state().query} activeId={state().activeId} />)
      setState({ query: 'aloft r', activeId: 'tab:2' })
      expect(animate).not.toHaveBeenCalled()
    })
  })

  it('groups options under labelled sections', () => {
    renderPalette()
    expect(screen.getByRole('group', { name: 'sectionOpenTabs' })).toBeTruthy()
  })

  it('labels the keyword list', () => {
    const github = builtInKeyword('github')
    renderPalette({
      query: '@',
      sections: [
        {
          id: 'keywords',
          results: [
            {
              kind: 'keyword',
              id: 'keyword:github',
              keyword: github,
              url: 'https://github.com',
              listed: true,
            },
          ],
        },
      ],
      activeId: 'keyword:github',
    })
    expect(screen.getByRole('group', { name: 'sectionKeywords' })).toBeTruthy()
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

  it('leaves Esc and the arrows to an input method while it composes', () => {
    const props = renderPalette()
    const input = screen.getByRole('combobox')
    fireEvent.keyDown(input, { key: 'Escape', isComposing: true })
    fireEvent.keyDown(input, { key: 'ArrowDown', isComposing: true })
    expect(props.onClose).not.toHaveBeenCalled()
    expect(props.onMove).not.toHaveBeenCalled()
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

  it('focuses the input when its frame gets focus, unless focus is on a tile', () => {
    renderPalette({ pins, pinShortcuts: pins })
    const input = screen.getByRole('combobox')
    input.blur()
    window.dispatchEvent(new FocusEvent('focus'))
    expect(document.activeElement).toBe(input)
    const music = screen.getByRole('button', { name: 'Music' })
    music.focus()
    window.dispatchEvent(new FocusEvent('focus'))
    expect(document.activeElement).toBe(music)
  })

  it('leaves focus alone in the settings preview', () => {
    renderPalette({ autofocus: false })
    window.dispatchEvent(new FocusEvent('focus'))
    expect(document.activeElement).not.toBe(screen.getByRole('combobox'))
  })

  it('with nothing focused, keys still work as in the input', () => {
    const props = renderPalette()
    const input = screen.getByRole('combobox')
    input.blur()
    fireEvent.keyDown(document.body, { key: 'ArrowDown' })
    expect(props.onMove).toHaveBeenCalledWith('next')
    expect(document.activeElement).toBe(input)
    input.blur()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(props.onClose).toHaveBeenCalledOnce()
  })

  it("offers what's new in the footer only after an update", () => {
    const onWhatsNew = vi.fn()
    renderPalette({ whatsNew: '0.6.0', onWhatsNew })
    fireEvent.click(screen.getByRole('button', { name: 'hintWhatsNew' }))
    expect(onWhatsNew).toHaveBeenCalledOnce()
    cleanup()
    renderPalette()
    expect(screen.queryByRole('button', { name: 'hintWhatsNew' })).toBeNull()
  })

  describe('closing tabs', () => {
    const tabActive = { activeId: 'tab:2', query: 'aloft' }

    it('closes the selected tab with Delete once the cursor is at the end', () => {
      const onCloseTab = vi.fn()
      renderPalette({ ...tabActive, onCloseTab })
      const input = screen.getByRole('combobox') as HTMLInputElement
      input.setSelectionRange(2, 2)
      fireEvent.keyDown(input, { key: 'Delete' })
      expect(onCloseTab).not.toHaveBeenCalled()
      input.setSelectionRange(5, 5)
      fireEvent.keyDown(input, { key: 'Delete' })
      expect(onCloseTab).toHaveBeenCalledWith(sections[1]?.results[0])
    })

    it('leaves Delete alone on rows that are not open tabs, and where closing is off', () => {
      const onCloseTab = vi.fn()
      renderPalette({ onCloseTab })
      fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Delete' })
      expect(onCloseTab).not.toHaveBeenCalled()
      cleanup()
      renderPalette(tabActive)
      expect(screen.queryByRole('button', { name: 'closeTabLabel' })).toBeNull()
    })

    it("closes from the selected row's Close hint, without opening it", () => {
      const onCloseTab = vi.fn()
      const props = renderPalette({ ...tabActive, onCloseTab })
      const hint = screen.getByText('actionClose').closest('button')
      expect(hint?.getAttribute('aria-hidden')).toBe('true')
      fireEvent.click(hint as HTMLButtonElement)
      expect(onCloseTab).toHaveBeenCalledOnce()
      expect(props.onActivate).not.toHaveBeenCalled()
    })

    it('marks tabs from other windows', () => {
      renderPalette({ hostWindowId: 2 })
      expect(screen.getByText('resultOtherWindow')).toBeTruthy()
      cleanup()
      renderPalette({ hostWindowId: 1 })
      expect(screen.queryByText('resultOtherWindow')).toBeNull()
    })
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
  describe('actions chip', () => {
    const footer = () => screen.getByRole('contentinfo').textContent ?? ''

    it('sits in front of the input and renames the search', () => {
      renderPalette({ chip: 'actions', query: '' })
      const chip = screen.getByText('sectionActions')
      const input = screen.getByRole('combobox')
      expect(chip.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(input.getAttribute('placeholder')).toBe('placeholderActions')
      expect(document.querySelector('[data-mode]')?.getAttribute('data-mode')).toBe('actions')
    })

    it('says so when no action matches', () => {
      renderPalette({ chip: 'actions', query: 'zzz', sections: [], activeId: undefined })
      expect(screen.getByRole('status').textContent).toBe('actionsNone')
      cleanup()
      renderPalette({ chip: null, query: 'zzz', sections: [], activeId: undefined })
      expect(screen.queryByRole('status')).toBeNull()
    })

    it('is not shown for a > typed outside it', () => {
      renderPalette({ query: '>' })
      expect(screen.queryByText('sectionActions')).toBeNull()
      expect(document.querySelector('[data-mode]')?.getAttribute('data-mode')).toBe('search')
    })

    it('Backspace on an empty input leaves it; with text, it only edits', () => {
      const props = renderPalette({ chip: 'actions', query: 'pin' })
      const input = screen.getByRole('combobox')
      fireEvent.keyDown(input, { key: 'Backspace' })
      expect(props.onLeaveChip).not.toHaveBeenCalled()

      fireEvent.input(input, { target: { value: '' } })
      fireEvent.keyDown(input, { key: 'Backspace' })
      expect(props.onLeaveChip).toHaveBeenCalledOnce()
    })

    it('Escape leaves the chip instead of closing', () => {
      const props = renderPalette({ chip: 'actions', query: 'pin' })
      fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' })
      expect(props.onLeaveChip).toHaveBeenCalledOnce()
      expect(props.onClose).not.toHaveBeenCalled()
    })

    it('shows only the ways in and out of each mode', () => {
      const [chip, setChip] = createSignal<'actions' | null>(null)
      const base = baseProps()
      render(() => <Palette {...base} chip={chip()} />)
      expect(footer()).toContain('hintKeywords')
      expect(footer()).toContain('hintActions')
      expect(footer()).toContain('hintClose')
      expect(footer()).not.toContain('hintBack')

      setChip('actions')
      expect(footer()).toContain('hintBack')
      for (const gone of ['hintKeywords', 'hintActions', 'hintClose']) {
        expect(footer()).not.toContain(gone)
      }
    })
  })

  describe('keyword chip', () => {
    const youtube = builtInKeyword('youtube')

    it('shows the site in the chip and the input says what it does', () => {
      renderPalette({ chip: youtube, query: '' })
      expect(screen.getByText('YouTube')).toBeTruthy()
      expect(screen.getByRole('combobox').getAttribute('placeholder')).toBe('keywordSearch')
    })

    it('Tab enters an offered keyword instead of leaving the input', () => {
      const onTab = vi.fn(() => true)
      renderPalette({ onTab })
      const input = screen.getByRole('combobox')
      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
      input.dispatchEvent(event)
      expect(onTab).toHaveBeenCalled()
      expect(event.defaultPrevented).toBe(true)
    })

    it('Tab with nothing to enter cycles within the palette instead of leaving it', () => {
      renderPalette({ onTab: () => false, pins, pinShortcuts: pins })
      const input = screen.getByRole('combobox')
      fireEvent.keyDown(input, { key: 'Tab' })
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Mail' }))
      fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Tab', shiftKey: true })
      expect(document.activeElement).toBe(input)
      fireEvent.keyDown(input, { key: 'Tab', shiftKey: true })
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Music' }))
    })

    it('stays in the input on Tab when nothing else in the palette takes focus', () => {
      renderPalette({ onTab: () => false })
      const input = screen.getByRole('combobox')
      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
      input.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(true)
      expect(document.activeElement).toBe(input)
    })

    it('Backspace on an empty input leaves the chip', () => {
      const props = renderPalette({ chip: youtube, query: '' })
      fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Backspace' })
      expect(props.onLeaveChip).toHaveBeenCalled()
    })
  })

  describe('scope chip', () => {
    it('sits in front of the input, names the scope and says what is searched', () => {
      renderPalette({ chip: 'history', query: '' })
      const chip = screen.getByText('sectionHistory')
      const input = screen.getByRole('combobox')
      expect(chip.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(input.getAttribute('placeholder')).toBe('placeholderHistory')
      expect(document.querySelector('[data-mode]')?.getAttribute('data-mode')).toBe('actions')
    })

    it('names each scope', () => {
      renderPalette({ chip: 'tabs', query: '', sections: [], activeId: undefined })
      expect(screen.getByText('sectionOpenTabs')).toBeTruthy()
      expect(screen.getByRole('combobox').getAttribute('placeholder')).toBe('placeholderTabs')
      cleanup()
      renderPalette({ chip: 'bookmarks', query: '' })
      expect(screen.getByText('sectionBookmarks')).toBeTruthy()
      expect(screen.getByRole('combobox').getAttribute('placeholder')).toBe('placeholderBookmarks')
    })

    it('says so when nothing in the scope matches', () => {
      renderPalette({ chip: 'tabs', query: 'zzz', sections: [], activeId: undefined })
      expect(screen.getByRole('status').textContent).toBe('scopeNone')
    })

    it('Backspace on an empty input and Escape leave it, and the footer offers the way back', () => {
      const props = renderPalette({ chip: 'bookmarks', query: '' })
      const input = screen.getByRole('combobox')
      fireEvent.keyDown(input, { key: 'Backspace' })
      fireEvent.keyDown(input, { key: 'Escape' })
      expect(props.onLeaveChip).toHaveBeenCalledTimes(2)
      expect(props.onClose).not.toHaveBeenCalled()
      const footer = screen.getByRole('contentinfo').textContent ?? ''
      expect(footer).toContain('hintBack')
      expect(footer).not.toContain('hintKeywords')
    })

    it('lists scopes from @ under their own label, ahead of the keywords', () => {
      renderPalette({
        query: '@',
        activeId: 'scope:tabs',
        sections: [
          { id: 'scopes', results: [{ kind: 'scope', id: 'scope:tabs', scope: 'tabs' }] },
          {
            id: 'keywords',
            results: [
              {
                kind: 'keyword',
                id: 'keyword:youtube',
                keyword: builtInKeyword('youtube'),
                url: 'https://www.youtube.com',
                listed: true,
              },
            ],
          },
        ],
      })
      const groups = screen.getAllByRole('group')
      expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual([
        'sectionScopes',
        'sectionKeywords',
      ])
      expect(groups[0]?.textContent).toContain('@tabs')
    })
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

    it('labels each tile with its title and marks only sleeping pins', () => {
      renderPalette({ pins, pinShortcuts: pins })
      const mail = screen.getByRole('button', { name: 'Mail' })
      const calendar = screen.getByRole('button', { name: 'Calendar' })
      expect(mail.textContent).toContain('Mail')
      expect(mail.hasAttribute('data-asleep')).toBe(false)
      expect(calendar.hasAttribute('data-asleep')).toBe(true)
      expect(calendar.title).toBe('pinnedAsleepTitle')
      expect(mail.title).toBe('Mail')
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

    it('types a symbol Option makes on a Mac layout instead of opening a pin', () => {
      const props = renderPalette({ pins, pinShortcuts: pins })
      fireEvent.keyDown(screen.getByRole('combobox'), { key: '[', code: 'Digit5', altKey: true })
      expect(props.onOpenPin).not.toHaveBeenCalled()
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

    it('typing on a focused tile moves to the input, while Space still presses the tile', () => {
      renderPalette({ pins, pinShortcuts: pins })
      const music = screen.getByRole('button', { name: 'Music' })
      music.focus()
      fireEvent.keyDown(music, { key: ' ' })
      expect(document.activeElement).toBe(music)
      fireEvent.keyDown(music, { key: 'Control', ctrlKey: true })
      expect(document.activeElement).toBe(music)
      fireEvent.keyDown(music, { key: 'g' })
      expect(document.activeElement).toBe(screen.getByRole('combobox'))
    })

    it('typing in the menu closes it and moves to the input', () => {
      renderPalette({ pins, pinShortcuts: pins })
      fireEvent.contextMenu(screen.getByRole('button', { name: 'Mail' }))
      fireEvent.keyDown(screen.getByRole('menuitem', { name: 'menuOpen' }), { key: 'g' })
      expect(screen.queryByRole('menu')).toBeNull()
      expect(document.activeElement).toBe(screen.getByRole('combobox'))
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
