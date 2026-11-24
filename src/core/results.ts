import type { ActionEntry, ActionId } from './actions'
import { type Keyword, keywordHost, keywordUrl } from './keywords'
import type { ParsedQuery } from './query'

export interface TabEntry {
  tabId: number
  windowId: number
  index: number
  pinned: boolean
  /** False for sleeping tabs, including Helium's hibernated pins. */
  loaded: boolean
  title: string
  url: string
  lastAccessed: number
}

export interface HistoryEntry {
  title: string
  url: string
  visitCount: number
  lastVisitTime: number
}

export interface BookmarkEntry {
  id: string
  title: string
  url: string
}

export interface ClosedEntry {
  sessionId: string
  title: string
  url: string
}

export interface SourceData {
  tabs: readonly TabEntry[]
  history: readonly HistoryEntry[]
  bookmarks: readonly BookmarkEntry[]
  closed: readonly ClosedEntry[]
  /** The actions available right now, in display order. */
  actions: readonly ActionEntry[]
}

/** A `[start, end)` span of a title that matched what was typed. */
export type Highlight = readonly [start: number, end: number]

interface Highlighted {
  highlights?: readonly Highlight[]
}

export type Result =
  | { kind: 'search'; id: string; query: string }
  | { kind: 'url'; id: string; url: string }
  /**
   * Offers a keyword's chip; `url` is the site, for its icon. `listed` when it
   * comes from the "@" list rather than being typed out.
   */
  | { kind: 'keyword'; id: string; keyword: Keyword; url: string; listed?: boolean }
  /** Sends `query` to a keyword's site, or opens the site when it's empty. */
  | { kind: 'site'; id: string; keyword: Keyword; query: string; url: string }
  | ({
      kind: 'tab'
      id: string
      tabId: number
      windowId: number
      title: string
      url: string
    } & Highlighted)
  | ({ kind: 'history'; id: string; title: string; url: string } & Highlighted)
  | ({ kind: 'bookmark'; id: string; title: string; url: string } & Highlighted)
  | { kind: 'closed'; id: string; sessionId: string; title: string; url: string }
  | ({ kind: 'action'; id: string; action: ActionId; title: string; hint: string } & Highlighted)

export type SectionId = 'keywords' | 'top' | 'tabs' | 'history' | 'bookmarks' | 'closed' | 'actions'

export interface Section {
  id: SectionId
  results: Result[]
}

export interface BuildOptions {
  sources: { tabs: boolean; history: boolean; bookmarks: boolean; recentlyClosed: boolean }
  /** The tab Aloft is open in; listing it would only offer to switch to itself. */
  hostTabId: number | undefined
  /** Pins already have their own row then, so the empty list leaves them out. */
  pinnedRowShown: boolean
  /** The keyword the input names exactly, offered above the other results. */
  offeredKeyword?: Keyword
  /** Keywords listed above everything else while "@" is typed; this replaces the offer. */
  listedKeywords?: readonly Keyword[]
  now: number
}

// Small enough that every section stays visible without scrolling.
const LIMITS = { tabs: 4, history: 5, bookmarks: 3, emptyTabs: 5, closed: 3 } as const

const DAY = 24 * 60 * 60 * 1000

export function pageKey(url: string): string {
  return url.replace(/#.*$/, '').replace(/\/$/, '')
}

const bareUrl = (url: string) => url.replace(/^[a-z]+:\/\//i, '').replace(/^www\./i, '')

/** The address as rows show it: no scheme, no www, no slash after a bare host. */
export function displayUrl(url: string): string {
  return bareUrl(url).replace(/^([^/?#]+)\/$/, '$1')
}

const isWordStart = (text: string, index: number) =>
  index === 0 || !/[\p{L}\p{N}]/u.test(text.charAt(index - 1))

function termScore(term: string, title: string, url: string): number {
  let best = 0
  let index = title.indexOf(term)
  while (index !== -1 && best < 3) {
    best = Math.max(best, isWordStart(title, index) ? (index === 0 ? 4 : 3) : 1)
    index = title.indexOf(term, index + 1)
  }
  const shortUrl = bareUrl(url)
  if (shortUrl.startsWith(term)) best = Math.max(best, 4)
  else if (shortUrl.includes(term)) best = Math.max(best, 1)
  return best
}

export function matchScore(terms: readonly string[], title: string, url: string): number | null {
  const lowerTitle = title.toLowerCase()
  const lowerUrl = url.toLowerCase()
  let total = 0
  for (const term of terms) {
    const score = termScore(term, lowerTitle, lowerUrl)
    if (score === 0) return null
    total += score
  }
  return total
}

/**
 * Where each term matched the title, preferring the occurrence `matchScore`
 * counted: the start of the title, then the start of a word, then anywhere.
 */
export function highlightRanges(terms: readonly string[], title: string): Highlight[] {
  const lower = title.toLowerCase()
  // A few characters change length when lowercased ("İ"), which would shift
  // every index after them; leaving the title plain is better than marking the
  // wrong letters.
  if (lower.length !== title.length) return []
  const ranges: [number, number][] = []
  for (const term of terms) {
    if (term === '') continue
    let found = -1
    let index = lower.indexOf(term)
    while (index !== -1) {
      if (found === -1) found = index
      if (isWordStart(lower, index)) {
        found = index
        break
      }
      index = lower.indexOf(term, index + 1)
    }
    if (found !== -1) ranges.push([found, found + term.length])
  }
  ranges.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const range of ranges) {
    const last = merged.at(-1)
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1])
    else merged.push(range)
  }
  return merged
}

/**
 * The letter on a page's tile when the browser has no icon for it: the
 * title's first letter or digit, skipping punctuation and emoji, else the host's.
 */
export function tileLetter(title: string, url: string): string {
  const letter = /[\p{L}\p{N}]/u
  let host = ''
  try {
    host = new URL(url).hostname.replace(/^www\./i, '')
  } catch {}
  return (title.match(letter)?.[0] ?? host.match(letter)?.[0] ?? '').toLocaleUpperCase()
}

// Frequently and recently visited pages win ties between equally good matches.
function frecency(entry: HistoryEntry, now: number): number {
  const age = now - entry.lastVisitTime
  const recency = age < DAY ? 2 : age < 7 * DAY ? 1 : 0
  return Math.log2(1 + entry.visitCount) + recency
}

function ranked<T>(items: readonly T[], score: (item: T) => number | null, limit: number): T[] {
  return items
    .flatMap((item) => {
      const s = score(item)
      return s === null ? [] : [{ item, s }]
    })
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(({ item }) => item)
}

export const tabResult = (t: TabEntry): Extract<Result, { kind: 'tab' }> => ({
  kind: 'tab',
  id: `tab:${t.tabId}`,
  tabId: t.tabId,
  windowId: t.windowId,
  title: t.title,
  url: t.url,
})

export function buildSections(
  query: ParsedQuery,
  data: SourceData,
  options: BuildOptions,
): Section[] {
  const { sources, hostTabId, now } = options
  const tabs = sources.tabs ? data.tabs.filter((t) => t.tabId !== hostTabId) : []

  if (query.kind === 'actions') {
    const terms = query.text.toLowerCase().split(/\s+/).filter(Boolean)
    // Stable sort: equal scores keep the display order.
    const matched =
      terms.length === 0
        ? data.actions
        : ranked(data.actions, (a) => matchScore(terms, a.label, a.keywords), data.actions.length)
    return compact([
      {
        id: 'actions',
        results: matched.map((a) => ({
          kind: 'action',
          id: `action:${a.id}`,
          action: a.id,
          title: a.label,
          hint: a.hint,
          highlights: highlightRanges(terms, a.label),
        })),
      },
    ])
  }

  if (query.kind === 'empty') {
    const recentTabs = tabs
      .filter((t) => !(options.pinnedRowShown && t.pinned))
      .sort((a, b) => b.lastAccessed - a.lastAccessed)
      .slice(0, LIMITS.emptyTabs)
    const closed = sources.recentlyClosed ? data.closed.slice(0, LIMITS.closed) : []
    return compact([
      { id: 'tabs', results: recentTabs.map(tabResult) },
      {
        id: 'closed',
        results: closed.map((c) => ({ kind: 'closed', id: `closed:${c.sessionId}`, ...c })),
      },
    ])
  }

  if (query.kind === 'keyword') {
    const { keyword, text, terms } = query
    const host = keywordHost(keyword)
    const onSite = (pageUrl: string) => {
      try {
        const page = new URL(pageUrl).hostname.replace(/^www\./, '')
        return page === host || page.endsWith(`.${host}`)
      } catch {
        return false
      }
    }
    const history =
      sources.history && terms.length > 0
        ? ranked(
            dedupe(data.history.filter((h) => onSite(h.url))),
            (h) => {
              const score = matchScore(terms, h.title, h.url)
              return score === null ? null : score * 2 + frecency(h, now)
            },
            LIMITS.history,
          )
        : []
    return compact([
      {
        id: 'top',
        results: [
          { kind: 'site', id: 'site', keyword, query: text, url: keywordUrl(keyword, text) },
        ],
      },
      { id: 'history', results: history.map((h) => historyResult(h, terms)) },
    ])
  }

  const { terms, text, url } = query
  const top: Result[] = []
  const listed = options.listedKeywords ?? []
  const offered = listed.length > 0 ? undefined : options.offeredKeyword
  if (offered) {
    top.push({ kind: 'keyword', id: 'keyword', keyword: offered, url: keywordUrl(offered, '') })
  }
  if (url) top.push({ kind: 'url', id: 'url', url })
  top.push({ kind: 'search', id: 'search', query: text })

  const matchedTabs = ranked(tabs, (t) => matchScore(terms, t.title, t.url), LIMITS.tabs)
  const shown = new Set(matchedTabs.map((t) => pageKey(t.url)))

  const bookmarks = sources.bookmarks
    ? ranked(
        data.bookmarks.filter((b) => !shown.has(pageKey(b.url))),
        (b) => matchScore(terms, b.title, b.url),
        LIMITS.bookmarks,
      )
    : []
  for (const b of bookmarks) shown.add(pageKey(b.url))

  const history = sources.history
    ? ranked(
        dedupe(data.history.filter((h) => !shown.has(pageKey(h.url)))),
        (h) => {
          const score = matchScore(terms, h.title, h.url)
          return score === null ? null : score * 2 + frecency(h, now)
        },
        LIMITS.history,
      )
    : []

  return compact([
    {
      id: 'keywords',
      results: listed.map((k) => ({
        kind: 'keyword',
        id: `keyword:${k.id}`,
        keyword: k,
        url: keywordUrl(k, ''),
        listed: true,
      })),
    },
    { id: 'top', results: top },
    {
      id: 'tabs',
      results: matchedTabs.map((t) => ({
        ...tabResult(t),
        highlights: highlightRanges(terms, t.title),
      })),
    },
    { id: 'history', results: history.map((h) => historyResult(h, terms)) },
    {
      id: 'bookmarks',
      results: bookmarks.map((b) => ({
        kind: 'bookmark',
        id: `bookmark:${b.id}`,
        title: b.title,
        url: b.url,
        highlights: highlightRanges(terms, b.title),
      })),
    },
  ])
}

const historyResult = (h: HistoryEntry, terms: readonly string[]): Result => ({
  kind: 'history',
  id: `history:${h.url}`,
  title: h.title,
  url: h.url,
  highlights: highlightRanges(terms, h.title),
})

// History can hold the same page under several URLs (fragments, trailing
// slashes); keep the most visited one.
function dedupe(entries: readonly HistoryEntry[]): HistoryEntry[] {
  const byPage = new Map<string, HistoryEntry>()
  for (const entry of entries) {
    const key = pageKey(entry.url)
    const existing = byPage.get(key)
    if (!existing || entry.visitCount > existing.visitCount) byPage.set(key, entry)
  }
  return [...byPage.values()]
}

const compact = (sections: Section[]) => sections.filter((s) => s.results.length > 0)

export const flatten = (sections: readonly Section[]): Result[] =>
  sections.flatMap((s) => s.results)
