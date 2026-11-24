import { describe, expect, it } from 'vitest'
import { builtInKeyword } from './keywords'
import { applyInput, EMPTY_QUERY, parseQuery } from './query'
import {
  type BuildOptions,
  buildSections,
  displayUrl,
  flatten,
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

  it('lists a bookmark once when it comes from both the search and the full list', () => {
    const twice = { ...data, bookmarks: [...data.bookmarks, ...data.bookmarks] }
    const results = flatten(buildSections(parseInput('dash'), twice, options)).map((r) => r.id)
    expect(results.filter((id) => id === 'bookmark:b1')).toHaveLength(1)
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

describe('learned picks', () => {
  const learned = (url: string, score: number, title = 'Learned') => ({
    ...options,
    learned: [{ url, title, score }],
  })

  it('finds tabs by initials and typos', () => {
    expect(ids('wr')).toContain('tab:3')
    expect(ids('widnow')).toContain('tab:3')
  })

  it('puts a clearly learned page above search, as its open tab', () => {
    const results = ids('wr', learned('https://wiki.hypr.land/Configuring/Window-Rules', 2))
    expect(results.slice(0, 2)).toEqual(['tab:3', 'search'])
    expect(results.filter((id) => id === 'tab:3')).toHaveLength(1)
  })

  it('goes above an address too, but not above a keyword the input names', () => {
    const github = builtInKeyword('github')
    const opts = { ...learned('https://github.com/tomszir/aloft', 2), offeredKeyword: github }
    expect(ids('github.com', opts).slice(0, 3)).toEqual(['keyword', 'tab:2', 'url'])
  })

  it('uses the bookmark, then history, when the page is not open', () => {
    expect(ids('dash', learned('https://dash.test/aloft', 2))[0]).toBe('bookmark:b1')
    const closedPage = learned('https://gone.test/page', 2, 'Gone page')
    expect(ids('gone', closedPage)[0]).toBe('history:https://gone.test/page')
  })

  it('only lifts a page within its section while it is picked just once', () => {
    const opts = learned('https://notes.test/aloft', 1)
    const results = ids('aloft', opts)
    expect(results[0]).toBe('search')
    const history = results.filter((id) => id.startsWith('history:'))
    expect(history[0]).toBe('history:https://notes.test/aloft')
  })

  it('never offers the page Aloft is open over', () => {
    expect(ids('host', learned('https://host.test/', 5))[0]).toBe('search')
  })

  it('respects sources that are turned off', () => {
    const off = {
      ...learned('https://gone.test/page', 2, 'Gone page'),
      sources: { ...options.sources, history: false },
    }
    expect(ids('gone', off)).toEqual(['search'])
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

describe('highlights', () => {
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
