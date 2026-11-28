import { type ActionId, duplicateTabs, type WindowEntry } from '../../core/actions'
import type { Result } from '../../core/results'
import type { HeldTyping } from '../../platform/messages'
import type { Disposition, HostTab, OpenContext } from '../../platform/open-result'
import { session } from '../session'
import { would } from '../would'

// Stands in for src/platform/palette-api.ts in the demo build: the same calls,
// answered from the invented browser in memory. Nothing here leaves the page;
// what would have, the host page hears about through `would`.

export const currentTab = async (): Promise<HostTab | undefined> => session().browser.host()
export const loadTabs = async () => session().browser.tabs()
/** The demo's browser has one window, so no tab is ever offered a move. */
export async function loadWindows(): Promise<WindowEntry[]> {
  const tabs = session().browser.tabs()
  const title = tabs.find((t) => t.tabId === session().browser.hostId)?.title ?? ''
  return [{ windowId: 1, title, tabCount: tabs.length, incognito: false }]
}
export const isBookmarked = async (url: string) =>
  session()
    .browser.bookmarks()
    .some((b) => b.url === url)
export const loadRecentHistory = async () => session().browser.recentHistory()
export const loadBookmarks = async () => session().browser.bookmarks()
export const loadRecentlyClosed = async () => session().browser.recentlyClosed()

export async function searchHistory(text: string) {
  const s = session()
  s.hooks.signal({ kind: 'search', text })
  return s.browser.searchHistory(text)
}

export const searchBookmarks = async (text: string) => session().browser.searchBookmarks(text)

function switchTo(tabId: number): void {
  const s = session()
  const tab = s.browser.focus(tabId)
  if (!tab) return
  s.hooks.would(would.switchTo(tab.title))
  if (tab.pinned) s.hooks.signal({ kind: 'open-pin' })
}

export async function openResult(
  result: Result,
  disposition: Disposition,
  context: OpenContext,
): Promise<boolean> {
  const s = session()
  s.acted = true
  switch (result.kind) {
    case 'tab':
      switchTo(result.tabId)
      break
    case 'closed': {
      const entry = s.browser.restore(result.sessionId)
      if (entry) s.hooks.would(would.reopen(entry.title))
      break
    }
    case 'search':
      s.hooks.would(would.search(result.query))
      break
    case 'url':
    case 'site':
    case 'history':
    case 'bookmark': {
      const open = context.switchToOpenTabs ? s.browser.openTabFor(result.url) : undefined
      if (open) {
        switchTo(open.tabId)
        break
      }
      const title = result.kind === 'history' || result.kind === 'bookmark' ? result.title : ''
      s.hooks.would(would.open({ title, url: result.url }, disposition))
      // A new tab shows up among the open tabs next time; loading a page here
      // would replace the page the demo sits on, which it can't.
      if (disposition === 'new-tab') s.browser.openTab(result.url, title || result.url)
      break
    }
    case 'keyword':
      break
  }
  // Never "replaced": the palette is still there, and closes itself.
  return false
}

export async function runAction(action: ActionId, target: { host: HostTab }): Promise<boolean> {
  const s = session()
  const { browser } = s
  const hostId = target.host.id
  s.acted = true
  s.hooks.signal({ kind: 'action', action })
  switch (action) {
    case 'pin':
    case 'unpin':
      browser.setPinned(hostId, action === 'pin')
      return false
    case 'duplicate':
      browser.duplicate(hostId)
      return false
    case 'close-other-tabs':
      browser.closeOthers(hostId)
      return false
    case 'close-duplicate-tabs':
      for (const id of duplicateTabs(browser.tabs(), target.host)) browser.close(id)
      return false
    case 'reopen-closed-tab': {
      const last = browser.recentlyClosed()[0]
      const entry = last ? browser.restore(last.sessionId) : undefined
      if (entry) s.hooks.would(would.reopen(entry.title))
      return false
    }
    default:
      // The rest would leave or change the page the demo sits on (new tabs
      // and windows, reloading or closing it, the browser's own pages and
      // Aloft's settings), or reach past the demo's invented browser.
      s.hooks.would(would.run(action))
      return false
  }
}

export async function movePinned(tabId: number, index: number): Promise<void> {
  session().browser.move(tabId, index)
}

export async function unpin(tabId: number): Promise<void> {
  session().browser.setPinned(tabId, false)
}

export async function closeTab(tabId: number): Promise<void> {
  session().browser.close(tabId)
}

/** After acting, the bar opens again on what changed; otherwise it closes. */
export async function closeOverlay(_tabId: number): Promise<void> {
  const s = session()
  if (s.acted) {
    s.acted = false
    s.hooks.reopen()
  } else {
    s.hooks.dismiss()
  }
}

// Keys are typed straight into the demo's input; nothing is held for it.
export const takeTyped = async (_tabId: number): Promise<HeldTyping> => ({ text: '' })
export const zoomCorrection = async (_tabId: number) => 1
export const openWhatsNew = async (_host: HostTab) => undefined
export const watchTabs = (onChange: () => void): (() => void) =>
  session().browser.onChange(onChange)
export const watchZoom =
  (_tabId: number, _onChange: () => void): (() => void) =>
  () =>
    undefined
