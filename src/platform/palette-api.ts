import { browser } from 'wxt/browser'
import { type PaletteCallName, type PaletteCalls, paletteCalls } from './palette-calls'
import { relayed, watchRelayed } from './relay'
import { oncePerFrame, watchTabs as watchTabsHere } from './sources'
import { watchZoom as watchZoomHere } from './zoom'

// Firefox gives a palette framed inside a website no tabs API (see relay.ts).
// Its new tab page and the settings preview aren't framed by a website, so
// they still call the browser directly. Chromium builds drop the relay.
const viaRelay = import.meta.env.FIREFOX && browser.tabs === undefined

const here = paletteCalls(() => browser.tabs.getCurrent())
const call = <K extends PaletteCallName>(name: K): PaletteCalls[K] =>
  viaRelay ? relayed(name) : here[name]

export const currentTab = call('currentTab')
export const loadTabs = call('loadTabs')
export const searchHistory = call('searchHistory')
export const loadRecentHistory = call('loadRecentHistory')
export const searchBookmarks = call('searchBookmarks')
export const loadBookmarks = call('loadBookmarks')
export const loadRecentlyClosed = call('loadRecentlyClosed')
export const openResult = call('openResult')
export const runAction = call('runAction')
export const movePinned = call('movePinned')
export const unpin = call('unpin')
export const zoomCorrection = call('zoomCorrection')
export const closeOverlay = call('closeOverlay')
export const takeTyped = call('takeTyped')
export const closeTab = call('closeTab')

export function watchTabs(onChange: () => void): () => void {
  return viaRelay ? watchRelayed({ kind: 'tabs' }, oncePerFrame(onChange)) : watchTabsHere(onChange)
}

export function watchZoom(tabId: number, onChange: () => void): () => void {
  return viaRelay ? watchRelayed({ kind: 'zoom', tabId }, onChange) : watchZoomHere(tabId, onChange)
}
