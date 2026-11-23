import { browser } from 'wxt/browser'
import type { BookmarkEntry, ClosedEntry, HistoryEntry, TabEntry } from '../core/results'

// Aloft's own pages and blank about: pages are never worth switching to or
// reopening.
const ownOrigin = () => browser.runtime.getURL('/')
const isOwnPage = (url: string) => url.startsWith(ownOrigin())
const isWorthListing = (url: string) => !isOwnPage(url) && !url.startsWith('about:')

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

/** Batched into one call per frame: closing a window fires an event per tab. */
export function watchTabs(onChange: () => void): () => void {
  let scheduled = false
  const schedule = () => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      onChange()
    })
  }
  const events = [
    browser.tabs.onCreated,
    browser.tabs.onRemoved,
    browser.tabs.onUpdated,
    browser.tabs.onMoved,
    browser.tabs.onAttached,
    browser.tabs.onDetached,
  ] as const
  for (const event of events) event.addListener(schedule)
  return () => {
    for (const event of events) event.removeListener(schedule)
  }
}

export async function searchHistory(text: string): Promise<HistoryEntry[]> {
  const items = await browser.history.search({ text, startTime: 0, maxResults: 50 })
  return items.flatMap((h) =>
    h.url && isWorthListing(h.url)
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

export async function searchBookmarks(text: string): Promise<BookmarkEntry[]> {
  const nodes = await browser.bookmarks.search(text)
  // Folders match too; they have no URL to open.
  return nodes.flatMap((b) => (b.url ? [{ id: b.id, title: b.title || b.url, url: b.url }] : []))
}

export async function loadRecentlyClosed(): Promise<ClosedEntry[]> {
  const sessions = await browser.sessions.getRecentlyClosed({ maxResults: 10 })
  // Closed windows are left out: restoring one from a single row would be a
  // surprise.
  return sessions.flatMap((s) => {
    const tab = s.tab
    if (!tab?.sessionId || !tab.url || !isWorthListing(tab.url)) return []
    return [{ sessionId: tab.sessionId, title: tab.title || tab.url, url: tab.url }]
  })
}
