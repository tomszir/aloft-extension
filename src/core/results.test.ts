import { describe, expect, it } from 'vitest'
import { builtInKeyword } from './keywords'
import { applyInput, EMPTY_QUERY, parseQuery } from './query'
import {
  type BuildOptions,
  buildSections,
  displayUrl,
  flatten,
  highlightRanges,
  matchScore,
  pageKey,
  type SourceData,
  tileLetter,
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

// As if typed into an empty palette, so "> undo" goes through the chip.
const parseInput = (input: string) => {
  const { chip, text } = applyInput(EMPTY_QUERY, input)
  return parseQuery(text, chip)
}

const ids = (query: string, opts = options) =>
  flatten(buildSections(parseInput(query), data, opts)).map((r) => r.id)

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
    const [section] = buildSections(parseQuery('new', 'actions'), data, options)
    expect(section?.results[0]).toMatchObject({ kind: 'action', hint: 'Ctrl+N' })
  })
})

describe('keywords', () => {
  const github = builtInKeyword('github')

  it('offers a keyword the input names, above the usual results', () => {
    expect(ids('gh', { ...options, offeredKeyword: github }).slice(0, 2)).toEqual([
      'keyword',
      'search',
    ])
  })

  it('lists keywords above everything else while @ is typed, instead of the offer', () => {
    const youtube = builtInKeyword('youtube')
    const sections = buildSections(parseQuery('@g'), data, {
      ...options,
      offeredKeyword: github,
      listedKeywords: [github, youtube],
    })
    expect(sections[0]?.id).toBe('keywords')
    expect(sections[0]?.results).toEqual([
      {
        kind: 'keyword',
        id: 'keyword:github',
        keyword: github,
        url: 'https://github.com',
        listed: true,
      },
      {
        kind: 'keyword',
        id: 'keyword:youtube',
        keyword: youtube,
        url: 'https://www.youtube.com',
        listed: true,
      },
    ])
    expect(flatten(sections).filter((r) => r.id === 'keyword')).toEqual([])
  })

  it('inside a chip, sends the text to the site and lists only that site’s pages', () => {
    const results = flatten(buildSections(parseQuery('aloft', github), data, options))
    expect(results[0]).toMatchObject({
      kind: 'site',
      query: 'aloft',
      url: 'https://github.com/search?q=aloft',
    })
    expect(results.slice(1).map((r) => r.id)).toEqual([
      'history:https://github.com/tomszir/aloft/',
      'history:https://github.com/tomszir/aloft/issues#top',
    ])
  })

  it('with nothing typed in the chip, offers the site itself', () => {
    const results = flatten(buildSections(parseQuery('', github), data, options))
    expect(results).toEqual([
      { kind: 'site', id: 'site', keyword: github, query: '', url: 'https://github.com' },
    ])
  })
})

describe('highlightRanges', () => {
  it('marks each term where it matched, merging overlaps', () => {
    expect(highlightRanges(['win', 'rul'], 'Window rules')).toEqual([
      [0, 3],
      [7, 10],
    ])
    expect(highlightRanges(['wind', 'ndow'], 'Window rules')).toEqual([[0, 6]])
  })

  it('prefers a word start over an earlier mid-word match', () => {
    expect(highlightRanges(['al'], 'Totally Aloft')).toEqual([[8, 10]])
  })

  it('falls back to a mid-word match, and skips terms only the URL matched', () => {
    expect(highlightRanges(['ule'], 'Window rules')).toEqual([[8, 11]])
    expect(highlightRanges(['github'], 'tomszir/aloft')).toEqual([])
  })

  it('leaves titles plain when lowercasing would shift the indexes', () => {
    expect(highlightRanges(['ist'], 'İstanbul')).toEqual([])
  })

  it('is attached to matched results, and not to the empty list', () => {
    const query = parseInput('aloft')
    const tab = flatten(buildSections(query, data, options)).find((r) => r.id === 'tab:2')
    expect(tab && 'highlights' in tab && tab.highlights).toEqual([[8, 13]])
    const empty = flatten(buildSections(parseInput(''), data, options))
    expect(empty.some((r) => 'highlights' in r)).toBe(false)
  })
})

describe('tileLetter', () => {
  it('uses the first letter or digit of the title', () => {
    expect(tileLetter('(3) Inbox', 'https://mail.test/')).toBe('3')
    expect(tileLetter('— notes', 'https://mail.test/')).toBe('N')
  })

  it('falls back to the host without www', () => {
    expect(tileLetter('', 'https://www.example.test/a')).toBe('E')
    expect(tileLetter('', 'not a url')).toBe('')
  })
})

describe('displayUrl', () => {
  it('drops the scheme, www and the slash after a bare host', () => {
    expect(displayUrl('https://www.github.com/')).toBe('github.com')
    expect(displayUrl('https://github.com/tomszir/')).toBe('github.com/tomszir/')
    expect(displayUrl('https://github.com/?tab=1')).toBe('github.com/?tab=1')
  })
})

describe('pageKey', () => {
  it('ignores fragments and trailing slashes', () => {
    expect(pageKey('https://a.test/x/#y')).toBe(pageKey('https://a.test/x'))
  })
})
