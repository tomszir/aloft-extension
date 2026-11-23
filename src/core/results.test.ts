import { describe, expect, it } from 'vitest'
import { parseQuery } from './query'
import {
  type BuildOptions,
  buildSections,
  flatten,
  matchScore,
  pageKey,
  type SourceData,
} from './results'

const NOW = Date.UTC(2026, 10, 23)
const DAY = 24 * 60 * 60 * 1000

const options: BuildOptions = {
  sources: { tabs: true, history: true, bookmarks: true, recentlyClosed: true },
  hostTabId: 1,
  pinnedRowShown: true,
  now: NOW,
}

const tab = (
  tabId: number,
  windowId: number,
  title: string,
  url: string,
  lastAccessed: number,
  pinned = false,
) => ({ tabId, windowId, index: tabId, pinned, loaded: true, title, url, lastAccessed })

const data: SourceData = {
  tabs: [
    tab(1, 1, 'Host page', 'https://host.test/', NOW),
    tab(2, 1, 'tomszir/aloft', 'https://github.com/tomszir/aloft', NOW - 10),
    tab(3, 2, 'Window rules', 'https://wiki.hypr.land/Configuring/Window-Rules', NOW - 5),
    tab(4, 1, 'Mail', 'https://mail.test/', NOW - 1, true),
  ],
  history: [
    {
      title: 'Aloft issues',
      url: 'https://github.com/tomszir/aloft/issues',
      visitCount: 3,
      lastVisitTime: NOW - DAY * 30,
    },
    {
      title: 'Aloft issues',
      url: 'https://github.com/tomszir/aloft/issues#top',
      visitCount: 9,
      lastVisitTime: NOW - DAY * 30,
    },
    {
      title: 'tomszir/aloft',
      url: 'https://github.com/tomszir/aloft/',
      visitCount: 50,
      lastVisitTime: NOW,
    },
    {
      title: 'Aloft notes',
      url: 'https://notes.test/aloft',
      visitCount: 1,
      lastVisitTime: NOW - 1000,
    },
  ],
  bookmarks: [{ id: 'b1', title: 'Aloft dashboard', url: 'https://dash.test/aloft' }],
  closed: [{ sessionId: 's1', title: 'Closed page', url: 'https://closed.test/' }],
  actions: [
    { id: 'pin', label: 'Pin tab', keywords: 'pin', hint: '' },
    { id: 'duplicate', label: 'Duplicate tab', keywords: 'copy clone', hint: '' },
    { id: 'new-window', label: 'New window', keywords: 'window', hint: 'Ctrl+N' },
    {
      id: 'reopen-closed-tab',
      label: 'Reopen closed tab',
      keywords: 'restore undo',
      hint: 'Ctrl+Shift+T',
    },
  ],
}

const ids = (query: string, opts = options) =>
  flatten(buildSections(parseQuery(query), data, opts)).map((r) => r.id)

describe('matchScore', () => {
  it('requires every term', () => {
    expect(matchScore(['window', 'rules'], 'Window rules', 'https://x.test')).not.toBeNull()
    expect(matchScore(['window', 'nope'], 'Window rules', 'https://x.test')).toBeNull()
  })

  it('prefers word starts over mid-word matches', () => {
    const start = matchScore(['rul'], 'Window rules', 'https://x.test') ?? 0
    const middle = matchScore(['ule'], 'Window rules', 'https://x.test') ?? 0
    expect(start).toBeGreaterThan(middle)
  })

  it('matches the start of the URL without scheme or www', () => {
    expect(matchScore(['git'], 'Something else', 'https://www.github.com/')).toBe(4)
  })
})

describe('buildSections', () => {
  it('shows recent tabs and recently closed when empty, never the host tab', () => {
    expect(ids('')).toEqual(['tab:3', 'tab:2', 'closed:s1'])
  })

  it('lists pins with the other tabs only when they have no row of their own', () => {
    expect(ids('', { ...options, pinnedRowShown: false })).toEqual([
      'tab:4',
      'tab:3',
      'tab:2',
      'closed:s1',
    ])
  })

  it('still finds pins when searching', () => {
    expect(ids('mail')).toContain('tab:4')
  })

  it('offers search first, and the address first when it looks like one', () => {
    expect(ids('aloft')[0]).toBe('search')
    expect(ids('github.com/tomszir').slice(0, 2)).toEqual(['url', 'search'])
  })

  it('does not repeat a page that is already open', () => {
    const results = ids('aloft')
    expect(results).toContain('tab:2')
    expect(results).not.toContain('history:https://github.com/tomszir/aloft/')
  })

  it('collapses history duplicates to the most visited URL', () => {
    const results = ids('aloft issues')
    expect(results).toContain('history:https://github.com/tomszir/aloft/issues#top')
    expect(results).not.toContain('history:https://github.com/tomszir/aloft/issues')
  })

  it('leaves out sources that are turned off', () => {
    const off = { ...options, sources: { ...options.sources, history: false, bookmarks: false } }
    expect(ids('aloft', off)).toEqual(['search', 'tab:2'])
  })

  it('lists every available action in order for a bare >', () => {
    expect(ids('>')).toEqual([
      'action:pin',
      'action:duplicate',
      'action:new-window',
      'action:reopen-closed-tab',
    ])
  })

  it('filters actions by label and keywords, never other sources', () => {
    expect(ids('> undo')).toEqual(['action:reopen-closed-tab'])
    expect(ids('> tab')).toEqual(['action:pin', 'action:duplicate', 'action:reopen-closed-tab'])
    expect(ids('> aloft')).toEqual([])
  })

  it('carries the browser shortcut along as a hint', () => {
    const [section] = buildSections(parseQuery('> new'), data, options)
    expect(section?.results[0]).toMatchObject({ kind: 'action', hint: 'Ctrl+N' })
  })
})

describe('pageKey', () => {
  it('ignores fragments and trailing slashes', () => {
    expect(pageKey('https://a.test/x/#y')).toBe(pageKey('https://a.test/x'))
  })
})
