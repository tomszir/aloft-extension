import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Browser } from 'wxt/browser'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { HELD_KEYS_KEY, OVERLAY_OPTIONS_KEY, readHeldKeys, readOverlayOptions } from './messages'
import { openAloft, paletteTabUrl, prepareInPage } from './overlay'

const press = (key: string, init: KeyboardEventInit = {}, altGraph = false) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  // happy-dom reports AltGraph whenever Alt is held.
  Object.defineProperty(event, 'getModifierState', {
    value: (name: string) => name === 'AltGraph' && altGraph,
  })
  document.body.dispatchEvent(event)
  return event
}

describe('prepareInPage', () => {
  afterEach(() => {
    readHeldKeys(globalThis)?.release()
    vi.useRealTimers()
  })

  it('hands the overlay its options', () => {
    prepareInPage(OVERLAY_OPTIONS_KEY, { blur: false }, HELD_KEYS_KEY, 1000)
    expect(readOverlayOptions(globalThis)).toEqual({ blur: false })
  })

  it('keeps typing from the page and holds it as text', () => {
    const page = vi.fn()
    document.body.addEventListener('keydown', page)
    prepareInPage(OVERLAY_OPTIONS_KEY, { blur: true }, HELD_KEYS_KEY, 1000)

    for (const key of ['g', 'h', 'x', 'Backspace', ' ', 'é', 'Tab', 'ArrowDown']) {
      expect(press(key).defaultPrevented).toBe(true)
    }
    // AltGr+Q on a German layout, which Windows reports as Ctrl+Alt.
    expect(press('@', { altKey: true, ctrlKey: true }, true).defaultPrevented).toBe(true)
    expect(page).not.toHaveBeenCalled()
    expect(readHeldKeys(globalThis)?.text).toBe('gh é\t@')
    document.body.removeEventListener('keydown', page)
  })

  it('keeps Enter after the text, for the palette to act on, and nothing after it', () => {
    prepareInPage(OVERLAY_OPTIONS_KEY, { blur: true }, HELD_KEYS_KEY, 1000)
    const held = readHeldKeys(globalThis)
    press('Enter')
    expect(held?.submit).toBeUndefined()
    press('g')
    expect(press('Enter', { shiftKey: true }).defaultPrevented).toBe(true)
    press('x')
    expect(held?.text).toBe('g')
    expect(held?.submit).toBe('shift-enter')
  })

  it('holds Tab, which makes a keyword chip, and symbols typed with Option on a Mac', () => {
    prepareInPage(OVERLAY_OPTIONS_KEY, { blur: true }, HELD_KEYS_KEY, 1000)
    press('y')
    press('t')
    expect(press('Tab').defaultPrevented).toBe(true)
    expect(press('[', { altKey: true }).defaultPrevented).toBe(true)
    expect(readHeldKeys(globalThis)?.text).toBe('yt\t[')
  })

  it('lets Esc, function keys and shortcuts through', () => {
    prepareInPage(OVERLAY_OPTIONS_KEY, { blur: true }, HELD_KEYS_KEY, 1000)
    expect(press('Escape').defaultPrevented).toBe(false)
    expect(press('F5').defaultPrevented).toBe(false)
    expect(press('k', { ctrlKey: true }).defaultPrevented).toBe(false)
    expect(press('1', { altKey: true }).defaultPrevented).toBe(false)
    expect(readHeldKeys(globalThis)?.text).toBe('')
  })

  it('tells the overlay about each held key', () => {
    prepareInPage(OVERLAY_OPTIONS_KEY, { blur: true }, HELD_KEYS_KEY, 1000)
    const held = readHeldKeys(globalThis)
    const onKey = vi.fn()
    if (held) held.onKey = onKey
    press('a')
    expect(onKey).toHaveBeenCalledOnce()
  })

  it('gives the page its keys back if no overlay claims them in time', () => {
    vi.useFakeTimers()
    prepareInPage(OVERLAY_OPTIONS_KEY, { blur: true }, HELD_KEYS_KEY, 1000)
    vi.advanceTimersByTime(1000)
    expect(readHeldKeys(globalThis)).toBeUndefined()
    expect(press('a').defaultPrevented).toBe(false)
  })

  it('keeps holding once claimed, until released', () => {
    vi.useFakeTimers()
    prepareInPage(OVERLAY_OPTIONS_KEY, { blur: true }, HELD_KEYS_KEY, 1000)
    const held = readHeldKeys(globalThis)
    if (held) held.claimed = true
    vi.advanceTimersByTime(5000)
    expect(press('a').defaultPrevented).toBe(true)
    held?.release()
    expect(press('a').defaultPrevented).toBe(false)
  })

  it('replaces a hold left from before', () => {
    prepareInPage(OVERLAY_OPTIONS_KEY, { blur: true }, HELD_KEYS_KEY, 1000)
    const first = readHeldKeys(globalThis)
    prepareInPage(OVERLAY_OPTIONS_KEY, { blur: true }, HELD_KEYS_KEY, 1000)
    press('a')
    expect(first?.text).toBe('')
    expect(readHeldKeys(globalThis)?.text).toBe('a')
  })
})

describe('openAloft', () => {
  // A browser page, where the overlay can't be drawn.
  const browserPage = (incognito: boolean): Browser.tabs.Tab =>
    ({ id: 7, index: 0, windowId: 3, url: 'chrome://newtab/', incognito }) as Browser.tabs.Tab

  it("opens the palette as a tab beside a page it can't draw on", async () => {
    vi.spyOn(fakeBrowser.scripting, 'executeScript').mockRejectedValue(new Error('denied'))
    const create = vi.spyOn(fakeBrowser.tabs, 'create')
    await openAloft(browserPage(false))
    expect(create).toHaveBeenCalledWith({ url: paletteTabUrl(), windowId: 3, index: 1 })
  })

  it('in a private window, opens its tab there only where the browser keeps it there', async () => {
    vi.spyOn(fakeBrowser.scripting, 'executeScript').mockRejectedValue(new Error('denied'))
    const create = vi.spyOn(fakeBrowser.tabs, 'create')
    await openAloft(browserPage(true))
    // Chromium would move it to a normal window, where browsing is kept.
    expect(create).toHaveBeenCalledTimes(import.meta.env.FIREFOX ? 1 : 0)
  })
})
