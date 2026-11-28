import { type Browser, browser } from 'wxt/browser'
import type { BookmarkEntry, ClosedEntry, HistoryEntry, TabEntry } from '../core/results'

// Aloft's own pages and blank about: pages are never worth switching to or
// reopening.
const ownOrigin = () => browser.runtime.getURL('/')
const isOwnPage = (url: string) => url.startsWith(ownOrigin())
const isWorthListing = (url: string) => !isOwnPage(url) && !url.startsWith('about:')

// Pages a result could fail to open, so they aren't offered: an extension
// can't run bookmarklets, and Firefox won't let one open its file:, about: or
// other privileged addresses (docs/browsers.md).
const UNOPENABLE = import.meta.env.FIREFOX
  ? /^(javascript|file|about|chrome|resource|data|view-source|moz-extension):/i
  : /^javascript:/i
const isOpenable = (url: string) => isWorthListing(url) && !UNOPENABLE.test(url)

export async function loadTabs(): Promise<TabEntry[]> {
  const tabs = await browser.tabs.query({ windowType: 'normal' })
  return tabs.flatMap((t) => {
    const url = t.url || t.pendingUrl
    if (t.id === undefined || !url || !isWorthListing(url)) return []
    return [
      {
        tabId: t.id,
        windowId: t.windowId,
        index: t.index,
        pinned: t.pinned,
        // Chrome reports sleeping tabs as discarded/"unloaded"; Helium's
        // hibernated pins stay "loading" with no page behind them.
        loaded: !t.discarded && t.status === 'complete',
        title: t.title || url,
        url,
        lastAccessed: t.lastAccessed ?? 0,
      },
    ]
  })
}

/** Calls `listener` on every change to any tab. */
export function onTabEvent(listener: () => void): () => void {
  const events = [
    browser.tabs.onCreated,
    browser.tabs.onRemoved,
    browser.tabs.onUpdated,
    browser.tabs.onMoved,
    browser.tabs.onAttached,
    browser.tabs.onDetached,
  ] as const
  for (const event of events) event.addListener(listener)
  return () => {
    for (const event of events) event.removeListener(listener)
  }
}

/** Collapses a burst of calls into one per frame: closing a window fires an event per tab. */
export function oncePerFrame(callback: () => void): () => void {
  let scheduled = false
  return () => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      callback()
    })
  }
}

export const watchTabs = (onChange: () => void) => onTabEvent(oncePerFrame(onChange))

/**
 * Matches the way the browser does, by whole words. Initials and typos only
 * reach what `loadRecentHistory` and the learned picks bring in.
 */
export async function searchHistory(text: string, maxResults = 50): Promise<HistoryEntry[]> {
  const items = await browser.history.search({ text, startTime: 0, maxResults })
  return items.flatMap((h) =>
    h.url && isOpenable(h.url)
      ? [
          {
            title: h.title || h.url,
            url: h.url,
            visitCount: h.visitCount ?? 0,
            lastVisitTime: h.lastVisitTime ?? 0,
          },
        ]
      : [],
  )
}

/** The most recently visited pages, matched in Aloft rather than by the browser. */
export const loadRecentHistory = () => searchHistory('', 500)

/** Bookmarks the browser matches by whole words, as fast as typing. */
export async function searchBookmarks(text: string): Promise<BookmarkEntry[]> {
  const nodes = await browser.bookmarks.search(text)
  // Folders match too; they have no URL to open.
  return nodes.flatMap((b) =>
    b.url && isOpenable(b.url)
      ? [{ id: b.id, title: b.title || b.url, url: b.url, dateAdded: b.dateAdded }]
      : [],
  )
}

/**
 * Every bookmark, so Aloft can match them by initials and typos. Slow for
 * large libraries: about 25 ms for 5,000 bookmarks and 95 ms for 20,000.
 */
export async function loadBookmarks(): Promise<BookmarkEntry[]> {
  const out: BookmarkEntry[] = []
  const walk = (nodes: readonly Browser.bookmarks.BookmarkTreeNode[]) => {
    for (const node of nodes) {
      // Folders have no URL to open.
      if (node.url && isOpenable(node.url))
        out.push({
          id: node.id,
          title: node.title || node.url,
          url: node.url,
          dateAdded: node.dateAdded,
        })
      if (node.children) walk(node.children)
    }
  }
  walk(await browser.bookmarks.getTree())
  return out
}

export async function loadRecentlyClosed(): Promise<ClosedEntry[]> {
  const sessions = await browser.sessions.getRecentlyClosed({ maxResults: 10 })
  // Closed windows are left out: restoring one from a single row would be a
  // surprise.
  return sessions.flatMap((s) => {
    const tab = s.tab
    // Restored by session, not opened by address, so any page can come back.
    if (!tab?.sessionId || !tab.url || !isWorthListing(tab.url)) return []
    return [{ sessionId: tab.sessionId, title: tab.title || tab.url, url: tab.url }]
  })
}
