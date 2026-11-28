import { type Browser, browser } from 'wxt/browser'
import { runAction } from './actions'
import {
  CLOSE_OVERLAY,
  type CloseOverlayMessage,
  type HeldTyping,
  readHeldTyping,
  TAKE_TYPED,
  type TakeTypedMessage,
} from './messages'
import { type HostTab, openResult } from './open-result'
import { movePinned, unpin } from './pinned'
import {
  loadBookmarks,
  loadRecentHistory,
  loadRecentlyClosed,
  loadTabs,
  searchBookmarks,
  searchHistory,
} from './sources'
import { zoomCorrection } from './zoom'

function toHostTab(tab: Browser.tabs.Tab | undefined): HostTab | undefined {
  return tab?.id === undefined
    ? undefined
    : { id: tab.id, index: tab.index, windowId: tab.windowId, openerTabId: tab.openerTabId }
}

async function closeOverlay(tabId: number): Promise<void> {
  const message: CloseOverlayMessage = { type: CLOSE_OVERLAY }
  await browser.tabs.sendMessage(tabId, message, { frameId: 0 })
}

/** What was typed on the page while the overlay palette loaded; see prepareInPage. */
async function takeTyped(tabId: number): Promise<HeldTyping> {
  const message: TakeTypedMessage = { type: TAKE_TYPED }
  return readHeldTyping(await browser.tabs.sendMessage(tabId, message, { frameId: 0 }))
}

/** Opens the settings page at what's new, next to the tab the palette is on. */
async function openWhatsNew(host: HostTab): Promise<void> {
  await browser.tabs.create({
    url: browser.runtime.getURL('/options.html#whats-new'),
    windowId: host.windowId,
    index: host.index + 1,
  })
}

// window.close() is ignored for tabs the script didn't open itself.
// Closing the active tab, Chromium moves to its neighbour, not to the tab it
// was opened from, so that one is made active first when given.
async function closeTab(tabId: number, returnTo?: number): Promise<void> {
  if (returnTo !== undefined)
    await browser.tabs.update(returnTo, { active: true }).catch(() => undefined)
  await browser.tabs.remove(tabId)
}

/**
 * Everything the palette asks of the browser, as one table so the Firefox
 * relay can serve the same calls. Arguments and results are plain data, since
 * they may cross extension messaging. `tab` is the tab the palette is in.
 */
export function paletteCalls(tab: () => Promise<Browser.tabs.Tab | undefined>) {
  return {
    currentTab: async () => toHostTab(await tab()),
    loadTabs,
    searchHistory,
    loadRecentHistory,
    searchBookmarks,
    loadBookmarks,
    loadRecentlyClosed,
    openResult,
    runAction,
    movePinned,
    unpin,
    zoomCorrection,
    closeOverlay,
    takeTyped,
    openWhatsNew,
    closeTab,
  }
}

export type PaletteCalls = ReturnType<typeof paletteCalls>
export type PaletteCallName = keyof PaletteCalls
