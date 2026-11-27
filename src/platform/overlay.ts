import { type Browser, browser } from 'wxt/browser'
import type { Settings } from '../core/settings'
import { HELD_KEYS_KEY, type HeldKeys, OVERLAY_OPTIONS_KEY, type OverlayOptions } from './messages'
import { loadSettings } from './settings'

export const OVERLAY_SCRIPT = '/content-scripts/overlay.js'

export function paletteTabUrl(): string {
  return `${browser.runtime.getURL('/palette.html')}?host=tab`
}

export function isOwnPage(url: string | undefined): boolean {
  return url?.startsWith(browser.runtime.getURL('/')) ?? false
}

// Long enough for any overlay to be drawn after its options were set; past
// it, a hold nothing took over stops keeping keys from the page.
const HOLD_GIVE_UP_MS = 1000

/**
 * Sets the overlay's options, and keeps what's typed on the page from the page
 * from the moment the shortcut is handled until the palette can take it; the
 * overlay hands it over when the palette asks. Without this, keys typed while
 * Aloft opens are lost, or worse, set off the page's own shortcuts. Esc passes,
 * so it still closes, and so do function keys and keys with Ctrl, Alt or Meta,
 * which may be the browser's.
 *
 * executeScript serializes this function into the page, so it can't close
 * over anything: everything comes in through arguments.
 */
export function prepareInPage(
  optionsKey: string,
  options: OverlayOptions,
  key: string,
  giveUpMs: number,
): void {
  Reflect.set(globalThis, optionsKey, options)
  const previous: unknown = Reflect.get(globalThis, key)
  if (typeof previous === 'object' && previous !== null && 'release' in previous) {
    const release: unknown = previous.release
    if (typeof release === 'function') release()
  }
  // AltGr types characters, though Windows reports it as Ctrl+Alt.
  // Option with a symbol on a Mac layout ([ ] | { } @) types it; with a
  // letter or digit it's a shortcut. Same rule as typesWithAlt in core.
  const typesWithAlt = (event: KeyboardEvent) =>
    event.altKey && !event.ctrlKey && /^[!-/:-@[-`{-~]$/.test(event.key)
  const passes = (event: KeyboardEvent) =>
    event.isComposing ||
    event.key === 'Escape' ||
    /^F\d+$/.test(event.key) ||
    event.metaKey ||
    ((event.ctrlKey || event.altKey) && !event.getModifierState('AltGraph') && !typesWithAlt(event))
  const held: HeldKeys = {
    text: '',
    submit: undefined,
    claimed: false,
    onKey: undefined,
    release: () => {
      removeEventListener('keydown', onKeyDown, true)
      removeEventListener('keyup', onKeyUp, true)
      if (Reflect.get(globalThis, key) === held) Reflect.deleteProperty(globalThis, key)
    },
  }
  function onKeyDown(event: KeyboardEvent): void {
    if (passes(event)) return
    event.preventDefault()
    event.stopImmediatePropagation()
    // After Enter the palette would already have gone; what follows went
    // nowhere, so it isn't kept either.
    if (held.submit) return
    if (event.key === 'Enter' && held.text.trim() !== '')
      held.submit = event.shiftKey ? 'shift-enter' : 'enter'
    else if (event.key === 'Backspace') held.text = [...held.text].slice(0, -1).join('')
    // Tab is kept as a tab character: after a keyword it makes the chip.
    else if (event.key === 'Tab' && !event.shiftKey) held.text += '\t'
    else if ([...event.key].length === 1) held.text += event.key
    held.onKey?.()
  }
  function onKeyUp(event: KeyboardEvent): void {
    if (!passes(event)) event.stopImmediatePropagation()
  }
  addEventListener('keydown', onKeyDown, true)
  addEventListener('keyup', onKeyUp, true)
  Reflect.set(globalThis, key, held)
  setTimeout(() => {
    if (!held.claimed) held.release()
  }, giveUpMs)
}

/**
 * Hands the overlay its options and starts holding keys for it, which also
 * tells whether the page takes scripts at all: false when it refuses them
 * (browser pages, the Web Store, the PDF viewer) or Aloft has no access to it.
 */
export async function prepareOverlay(tabId: number, settings: Settings): Promise<boolean> {
  const options: OverlayOptions = { blur: settings.appearance.blur }
  try {
    await browser.scripting.executeScript({
      target: { tabId },
      func: prepareInPage,
      args: [OVERLAY_OPTIONS_KEY, options, HELD_KEYS_KEY, HOLD_GIVE_UP_MS],
    })
    return true
  } catch {
    return false
  }
}

/** Draws the overlay on a page that {@link prepareOverlay} succeeded on. */
export async function drawOverlay(tabId: number): Promise<boolean> {
  try {
    await browser.scripting.executeScript({ target: { tabId }, files: [OVERLAY_SCRIPT] })
    return true
  } catch {
    return false
  }
}

export async function injectOverlay(tabId: number): Promise<boolean> {
  return (await prepareOverlay(tabId, await loadSettings())) && drawOverlay(tabId)
}

export async function openAloft(tab: Browser.tabs.Tab | undefined): Promise<void> {
  if (tab?.id === undefined) {
    await openPaletteTab()
    return
  }
  // Already on an Aloft page: its own input has focus, nothing to do.
  if (isOwnPage(tab.url ?? tab.pendingUrl)) return
  if (!(await injectOverlay(tab.id))) await openPaletteTab(tab)
}

export async function openPaletteTab(nextTo?: Browser.tabs.Tab): Promise<void> {
  await browser.tabs.create({
    url: paletteTabUrl(),
    windowId: nextTo?.windowId,
    index: nextTo ? nextTo.index + 1 : undefined,
  })
}
