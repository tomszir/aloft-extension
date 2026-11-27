import { type Browser, browser } from 'wxt/browser'
import { runAction } from './actions'
import {
  CLOSE_OVERLAY,
  type CloseOverlayMessage,
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
    : { id: tab.id, index: tab.index, windowId: tab.windowId }
}

async function closeOverlay(tabId: number): Promise<void> {
  const message: CloseOverlayMessage = { type: CLOSE_OVERLAY }
  await browser.tabs.sendMessage(tabId, message, { frameId: 0 })
}

/** What was typed on the page while the overlay palette loaded; see prepareInPage. */
async function takeTyped(tabId: number): Promise<string> {
  const message: TakeTypedMessage = { type: TAKE_TYPED }
  const reply: unknown = await browser.tabs.sendMessage(tabId, message, { frameId: 0 })
  return typeof reply === 'string' ? reply : ''
}

// window.close() is ignored for tabs the user opened, like Ctrl+T's.
async function closeTab(tabId: number): Promise<void> {
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
    closeTab,
  }
}

export type PaletteCalls = ReturnType<typeof paletteCalls>
export type PaletteCallName = keyof PaletteCalls
