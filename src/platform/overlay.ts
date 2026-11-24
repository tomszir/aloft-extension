import { type Browser, browser } from 'wxt/browser'
import type { Settings } from '../core/settings'
import { OVERLAY_OPTIONS_KEY, type OverlayOptions } from './messages'
import { loadSettings } from './settings'

export const OVERLAY_SCRIPT = '/content-scripts/overlay.js'

export function paletteTabUrl(): string {
  return `${browser.runtime.getURL('/palette.html')}?host=tab`
}

export function isOwnPage(url: string | undefined): boolean {
  return url?.startsWith(browser.runtime.getURL('/')) ?? false
}

// executeScript serializes this function into the page, so it can't close over
// anything: everything comes in through arguments.
function setOverlayOptions(key: string, options: OverlayOptions): void {
  Reflect.set(globalThis, key, options)
}

/**
 * Hands the overlay its options, which also tells whether the page takes
 * scripts at all: false when it refuses them (browser pages, the Web Store,
 * the PDF viewer) or Aloft has no access to it.
 */
export async function prepareOverlay(tabId: number, settings: Settings): Promise<boolean> {
  const options: OverlayOptions = { blur: settings.appearance.blur }
  try {
    await browser.scripting.executeScript({
      target: { tabId },
      func: setOverlayOptions,
      args: [OVERLAY_OPTIONS_KEY, options],
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
