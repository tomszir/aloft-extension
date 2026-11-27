import type { BookmarkEntry, ClosedEntry, HistoryEntry, TabEntry } from '../core/results'
import { pageKey } from '../core/url'
import { BOOKMARK, BOOKMARKS, CLOSED, HISTORY, PINS, type Site, siteUrl, TABS } from './sites'

/** What the palette calls the tab it's open over. */
export interface DemoHost {
  id: number
  index: number
  windowId: number
}

const WINDOW_ID = 1
const MINUTE = 60_000
const HOUR = 60 * MINUTE

interface Tab {
  tabId: number
  pinned: boolean
  loaded: boolean
  title: string
  url: string
  lastAccessed: number
}

/** Matches the way the browser's own searches do: every word, anywhere in the title or address. */
const matchesWords = (text: string, entry: { title: string; url: string }) => {
  const haystack = `${entry.title} ${entry.url}`.toLowerCase()
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word !== '')
    .every((word) => haystack.includes(word))
}

/**
 * The browser the web demo pretends to be: one window of invented tabs,
 * history, bookmarks and recently closed tabs, all in memory. Changes behave
 * like the browser's (pins stay in front, closing a tab makes it the most
 * recently closed), and every change tells the listeners, like tab events.
 */
export class DemoBrowser {
  readonly hostId: number
  private tabList: Tab[]
  private closedList: ClosedEntry[]
  private historyList: HistoryEntry[]
  private readonly bookmarkList: BookmarkEntry[]
  private nextTabId = 1
  private nextSessionId = 1
  private readonly listeners = new Set<() => void>()

  constructor(private readonly now: () => number = Date.now) {
    const start = now()
    const tab = (site: Site, pinned: boolean, age: number): Tab => ({
      tabId: this.nextTabId++,
      pinned,
      // One pin asleep, as a browser that saves memory would leave it.
      loaded: site !== PINS[3],
      title: site.title,
      url: siteUrl(site),
      lastAccessed: start - age,
    })
    this.tabList = [
      ...PINS.map((site, i) => tab(site, true, (i + 2) * HOUR)),
      ...TABS.map((site, i) => tab(site, false, i * 20 * MINUTE)),
    ]
    this.hostId = this.tabList[PINS.length]?.tabId ?? 0
    this.closedList = [this.closedEntry(CLOSED.title, siteUrl(CLOSED))]
    const visit = (title: string, url: string, i: number): HistoryEntry => ({
      title,
      url,
      visitCount: Math.max(1, 12 - i),
      lastVisitTime: start - (i + 1) * 3 * HOUR,
    })
    this.historyList = [
      ...[...PINS, ...TABS, CLOSED, BOOKMARK].map((site, i) => visit(site.title, siteUrl(site), i)),
      ...HISTORY.map((page, i) => visit(page.title, page.url, i + 4)),
    ]
    this.bookmarkList = [BOOKMARK, ...BOOKMARKS].map((b, i) => ({
      id: String(i + 1),
      title: b.title,
      url: 'url' in b ? b.url : siteUrl(b),
    }))
  }

  /** Calls `listener` after every change, like the browser's tab events. */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private changed(): void {
    for (const listener of [...this.listeners]) listener()
  }

  private closedEntry(title: string, url: string): ClosedEntry {
    return { sessionId: `session-${this.nextSessionId++}`, title, url }
  }

  host(): DemoHost {
    return { id: this.hostId, index: this.indexOf(this.hostId), windowId: WINDOW_ID }
  }

  private indexOf(tabId: number): number {
    return this.tabList.findIndex((t) => t.tabId === tabId)
  }

  tabs(): TabEntry[] {
    return this.tabList.map((t, index) => ({ ...t, windowId: WINDOW_ID, index }))
  }

  searchHistory(text: string, maxResults = 50): HistoryEntry[] {
    return this.historyList.filter((h) => matchesWords(text, h)).slice(0, maxResults)
  }

  recentHistory(maxResults = 500): HistoryEntry[] {
    return [...this.historyList]
      .sort((a, b) => b.lastVisitTime - a.lastVisitTime)
      .slice(0, maxResults)
  }

  searchBookmarks(text: string): BookmarkEntry[] {
    return text.trim() === '' ? [] : this.bookmarkList.filter((b) => matchesWords(text, b))
  }

  bookmarks(): BookmarkEntry[] {
    return [...this.bookmarkList]
  }

  recentlyClosed(): ClosedEntry[] {
    return this.closedList.slice(0, 10)
  }

  /** The open tab showing `url` (fragment aside), other than the host. */
  openTabFor(url: string): TabEntry | undefined {
    const key = pageKey(url)
    return this.tabs().find((t) => t.tabId !== this.hostId && pageKey(t.url) === key)
  }

  focus(tabId: number): TabEntry | undefined {
    const tab = this.tabList.find((t) => t.tabId === tabId)
    if (!tab) return undefined
    tab.lastAccessed = this.now()
    tab.loaded = true
    this.changed()
    return this.tabs().find((t) => t.tabId === tabId)
  }

  /** Opens `url` in a new tab next to the host, and remembers the visit. */
  openTab(url: string, title: string): void {
    this.insertAfterHost({
      tabId: this.nextTabId++,
      pinned: false,
      loaded: true,
      title,
      url,
      lastAccessed: this.now(),
    })
    this.historyList = [
      { title, url, visitCount: 1, lastVisitTime: this.now() },
      ...this.historyList.filter((h) => h.url !== url),
    ]
    this.changed()
  }

  private insertAfterHost(tab: Tab): void {
    const at = Math.max(this.indexOf(this.hostId) + 1, this.pinnedCount())
    this.tabList.splice(at, 0, tab)
  }

  private pinnedCount(): number {
    return this.tabList.filter((t) => t.pinned).length
  }

  close(tabId: number): void {
    // The page the demo sits on stays, as the page under the palette would.
    if (tabId === this.hostId) return
    const at = this.indexOf(tabId)
    const [tab] = at === -1 ? [] : this.tabList.splice(at, 1)
    if (!tab) return
    this.closedList.unshift(this.closedEntry(tab.title, tab.url))
    this.changed()
  }

  /** Like the browser's "Close other tabs": pins stay. */
  closeOthers(tabId: number): void {
    const others = this.tabList.filter((t) => t.tabId !== tabId && !t.pinned)
    if (others.length === 0) return
    this.tabList = this.tabList.filter((t) => !others.includes(t))
    for (const tab of others) this.closedList.unshift(this.closedEntry(tab.title, tab.url))
    this.changed()
  }

  restore(sessionId: string): ClosedEntry | undefined {
    const entry = this.closedList.find((c) => c.sessionId === sessionId)
    if (!entry) return undefined
    this.closedList = this.closedList.filter((c) => c !== entry)
    this.insertAfterHost({
      tabId: this.nextTabId++,
      pinned: false,
      loaded: true,
      title: entry.title,
      url: entry.url,
      lastAccessed: this.now(),
    })
    this.changed()
    return entry
  }

  duplicate(tabId: number): void {
    const tab = this.tabList.find((t) => t.tabId === tabId)
    if (!tab) return
    const copy = { ...tab, tabId: this.nextTabId++, pinned: false, lastAccessed: this.now() }
    this.tabList.splice(Math.max(this.indexOf(tabId) + 1, this.pinnedCount()), 0, copy)
    this.changed()
  }

  /** Pinning moves a tab to the end of the pins, unpinning to just after them, as browsers do. */
  setPinned(tabId: number, pinned: boolean): void {
    const at = this.indexOf(tabId)
    const tab = this.tabList[at]
    if (!tab || tab.pinned === pinned) return
    this.tabList.splice(at, 1)
    tab.pinned = pinned
    this.tabList.splice(this.pinnedCount(), 0, tab)
    this.changed()
  }

  /** Moves a tab to `index`, kept on its own side of the pins. */
  move(tabId: number, index: number): void {
    const at = this.indexOf(tabId)
    const tab = this.tabList[at]
    if (!tab) return
    this.tabList.splice(at, 1)
    const pins = this.pinnedCount()
    const [low, high] = tab.pinned ? [0, pins] : [pins, this.tabList.length]
    this.tabList.splice(Math.min(Math.max(index, low), high), 0, tab)
    this.changed()
  }
}
