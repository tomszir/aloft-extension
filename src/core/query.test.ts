import { describe, expect, it } from 'vitest'
import { builtInKeyword, resolveKeywords } from './keywords'
import {
  applyInput,
  availableScopes,
  EMPTY_QUERY,
  enterChip,
  leaveChip,
  listedKeywords,
  listedScopes,
  offeredKeyword,
  parseQuery,
  type QueryState,
  replayTyped,
  SCOPES,
  toUrl,
} from './query'

const keywords = resolveKeywords(undefined)
const youtube = builtInKeyword('youtube')

describe('parseQuery', () => {
  it('treats whitespace as empty', () => {
    expect(parseQuery('   ')).toEqual({ kind: 'empty' })
  })

  it('lists actions inside the actions chip, even with nothing typed', () => {
    expect(parseQuery(' pin ', 'actions')).toEqual({ kind: 'actions', text: 'pin' })
    expect(parseQuery('', 'actions')).toEqual({ kind: 'actions', text: '' })
  })

  it('searches for > outside the chip', () => {
    expect(parseQuery('> pin')).toMatchObject({ kind: 'text', text: '> pin' })
  })

  it('splits text into lowercase terms', () => {
    expect(parseQuery('  Hyprland  Rules ')).toMatchObject({
      kind: 'text',
      text: 'Hyprland  Rules',
      terms: ['hyprland', 'rules'],
      url: null,
    })
  })
})

describe('applyInput', () => {
  it('turns a leading > into the actions chip and keeps what follows', () => {
    expect(applyInput(EMPTY_QUERY, '>')).toEqual({ chip: 'actions', text: '' })
    expect(applyInput(EMPTY_QUERY, '  > pin')).toEqual({ chip: 'actions', text: 'pin' })
  })

  it('leaves other text and text inside a chip as typed', () => {
    expect(applyInput(EMPTY_QUERY, 'a > b')).toEqual({ chip: null, text: 'a > b' })
    expect(applyInput({ chip: 'actions', text: '' }, '>')).toEqual({ chip: 'actions', text: '>' })
  })
})

describe('keyword chips', () => {
  it('Space right after a keyword makes its chip, with or without @', () => {
    expect(applyInput(EMPTY_QUERY, 'yt ', keywords)).toEqual({ chip: youtube, text: '' })
    expect(applyInput(EMPTY_QUERY, ' @yt ', keywords)).toEqual({ chip: youtube, text: '' })
  })

  it('leaves other text alone, including a keyword followed by more words', () => {
    expect(applyInput(EMPTY_QUERY, 'yt', keywords)).toEqual({ chip: null, text: 'yt' })
    expect(applyInput(EMPTY_QUERY, 'yt cats', keywords)).toEqual({ chip: null, text: 'yt cats' })
    expect(applyInput(EMPTY_QUERY, 'nope ', keywords)).toEqual({ chip: null, text: 'nope ' })
  })

  it('offers the keyword the input names exactly', () => {
    expect(offeredKeyword({ chip: null, text: ' yt ' }, keywords)).toEqual(youtube)
    expect(offeredKeyword({ chip: null, text: 'yt cats' }, keywords)).toBeUndefined()
    expect(offeredKeyword(enterChip(youtube), keywords)).toBeUndefined()
  })

  it('lists keywords while the input is @ and at most one word', () => {
    const listed = (text: string) => listedKeywords({ chip: null, text }, keywords)
    expect(listed('@').length).toBe(keywords.filter((k) => k.enabled).length)
    expect(listed(' @you').map((k) => k.id)).toEqual(['youtube'])
    expect(listed('@yt cats')).toEqual([])
    expect(listed('you')).toEqual([])
    expect(listedKeywords({ chip: youtube, text: '@' }, keywords)).toEqual([])
  })

  it('parses text inside a keyword chip', () => {
    expect(parseQuery(' lofi  beats ', youtube)).toEqual({
      kind: 'keyword',
      keyword: youtube,
      text: 'lofi  beats',
      terms: ['lofi', 'beats'],
    })
  })

  it('gives back the keyword and text on leaving, without making the chip again', () => {
    const left = leaveChip({ chip: youtube, text: 'cats' })
    expect(left).toEqual({ chip: null, text: 'yt cats' })
    expect(leaveChip(enterChip(youtube))).toEqual({ chip: null, text: 'yt' })
    expect(applyInput(left, 'yt catsx', keywords).chip).toBeNull()
  })
})

describe('replayTyped', () => {
  it('enters held text as if typed, so a keyword and Space still make the chip', () => {
    expect(replayTyped(EMPTY_QUERY, 'aloft', keywords)).toEqual({ chip: null, text: 'aloft' })
    expect(replayTyped(EMPTY_QUERY, 'yt cats', keywords)).toEqual({ chip: youtube, text: 'cats' })
    expect(replayTyped(EMPTY_QUERY, '>pin', keywords)).toEqual({ chip: 'actions', text: 'pin' })
  })

  it('enters a keyword on a held Tab, as Tab in the input does, and drops other Tabs', () => {
    expect(replayTyped(EMPTY_QUERY, 'yt\tcats', keywords)).toEqual({ chip: youtube, text: 'cats' })
    expect(replayTyped(EMPTY_QUERY, 'nope\tx', keywords)).toEqual({ chip: null, text: 'nopex' })
  })

  it('goes in front of what the input took since, chips included', () => {
    expect(replayTyped({ chip: null, text: 'ft' }, 'alo')).toEqual({ chip: null, text: 'aloft' })
    expect(replayTyped({ chip: youtube, text: 'cats' }, 'y', keywords)).toEqual({
      chip: null,
      text: 'yyt cats',
    })
    expect(replayTyped(enterChip(youtube), '@', keywords)).toEqual({ chip: youtube, text: '' })
    expect(replayTyped({ chip: 'actions', text: 'pin' }, '')).toEqual({
      chip: 'actions',
      text: 'pin',
    })
  })
})

describe('scope chips', () => {
  const type = (text: string, scopes = SCOPES) => applyInput(EMPTY_QUERY, text, keywords, scopes)

  it('makes a scope chip from @, its name and Space, the singular too', () => {
    expect(type('@tabs ')).toEqual({ chip: 'tabs', text: '' })
    expect(type(' @tab ')).toEqual({ chip: 'tabs', text: '' })
    expect(type('@Bookmarks ')).toEqual({ chip: 'bookmarks', text: '' })
    expect(type('@bookmark ')).toEqual({ chip: 'bookmarks', text: '' })
    expect(type('@history ')).toEqual({ chip: 'history', text: '' })
  })

  it('never hijacks a plain search that starts with a scope name', () => {
    for (const text of ['tabs ', 'tabs vs spaces', 'history ', 'history of rome', 'bookmarks ']) {
      expect(type(text)).toEqual({ chip: null, text })
    }
    expect(type('@tabs vs spaces')).toEqual({ chip: null, text: '@tabs vs spaces' })
    expect(type('@ta ')).toEqual({ chip: null, text: '@ta ' })
    expect(type('@s ')).toEqual({ chip: null, text: '@s ' })
  })

  it('only makes chips for the scopes offered', () => {
    expect(type('@history ', ['tabs'])).toEqual({ chip: null, text: '@history ' })
    expect(type('@tabs ', [])).toEqual({ chip: null, text: '@tabs ' })
  })

  it("lets a keyword of the user's own with the same name win", () => {
    const own = resolveKeywords({
      custom: [
        {
          id: 'custom-t',
          name: 'Tabs site',
          keyword: 'tabs',
          url: 'https://t.ex/?q=%s',
          enabled: true,
        },
      ],
    })
    expect(applyInput(EMPTY_QUERY, '@tabs ', own, SCOPES).chip).toMatchObject({ id: 'custom-t' })
  })

  it('offers only the scopes whose source is switched on', () => {
    const on = { tabs: true, bookmarks: true, history: true, recentlyClosed: true }
    expect(availableScopes(on)).toEqual(['tabs', 'bookmarks', 'history'])
    expect(availableScopes({ ...on, bookmarks: false })).toEqual(['tabs', 'history'])
  })

  it('lists scopes while the input is @ and the start of one', () => {
    const listed = (text: string, chip: QueryState['chip'] = null) =>
      listedScopes({ chip, text }, SCOPES)
    expect(listed('@')).toEqual(['tabs', 'bookmarks', 'history'])
    expect(listed(' @H')).toEqual(['history'])
    expect(listed('@tabs')).toEqual(['tabs'])
    expect(listed('@yt')).toEqual([])
    expect(listed('@tabs x')).toEqual([])
    expect(listed('tabs')).toEqual([])
    expect(listed('@', 'tabs')).toEqual([])
    expect(listedScopes({ chip: null, text: '@' }, ['history'])).toEqual(['history'])
  })

  it('parses text inside a scope chip', () => {
    expect(parseQuery(' Rust  Book ', 'bookmarks')).toEqual({
      kind: 'scope',
      scope: 'bookmarks',
      text: 'Rust  Book',
      terms: ['rust', 'book'],
    })
    expect(parseQuery('', 'tabs')).toEqual({ kind: 'scope', scope: 'tabs', text: '', terms: [] })
  })

  it('gives back @ and the name on leaving, without making the chip again', () => {
    expect(leaveChip(enterChip('tabs'))).toEqual({ chip: null, text: '@tabs' })
    const left = leaveChip({ chip: 'history', text: 'rome ' })
    expect(left).toEqual({ chip: null, text: '@history rome' })
    expect(applyInput(left, '@history romex', keywords, SCOPES).chip).toBeNull()
  })

  it('replays held text into a scope, by Space or Tab, and keeps a scope chip', () => {
    expect(replayTyped(EMPTY_QUERY, '@tabs mail', keywords, SCOPES)).toEqual({
      chip: 'tabs',
      text: 'mail',
    })
    expect(replayTyped(EMPTY_QUERY, '@hist\tx', keywords, SCOPES)).toEqual({
      chip: null,
      text: '@histx',
    })
    expect(replayTyped(EMPTY_QUERY, '@tab\tx', keywords, SCOPES)).toEqual({
      chip: 'tabs',
      text: 'x',
    })
    expect(replayTyped({ chip: 'history', text: 'rome' }, '', keywords, SCOPES)).toEqual({
      chip: 'history',
      text: 'rome',
    })
  })
})

describe('leaveChip', () => {
  it('gives back the text that made the chip', () => {
    expect(leaveChip({ chip: 'actions', text: '' })).toEqual({ chip: null, text: '>' })
    expect(leaveChip({ chip: 'actions', text: 'pin ' })).toEqual({ chip: null, text: '> pin' })
  })

  it('does nothing without a chip', () => {
    const state = { chip: null, text: 'aloft' }
    expect(leaveChip(state)).toBe(state)
  })
})

describe('toUrl', () => {
  it.each([
    ['github.com', 'https://github.com/'],
    ['github.com/imputnet/helium', 'https://github.com/imputnet/helium'],
    ['Example.COM', 'https://example.com/'],
    ['sub.example.co.uk/path?q=1#x', 'https://sub.example.co.uk/path?q=1#x'],
    ['example.com:8080', 'https://example.com:8080/'],
    ['localhost', 'http://localhost/'],
    ['localhost:5173/app', 'http://localhost:5173/app'],
    ['192.168.1.10:8006', 'http://192.168.1.10:8006/'],
    ['https://example.com/a b', 'https://example.com/a%20b'],
    ['http://example.com', 'http://example.com/'],
    ['chrome://settings', 'chrome://settings'],
    ['helium://extensions', 'helium://extensions'],
    ['deno.land/x', 'https://deno.land/x'],
  ])('opens %s', (text, url) => {
    expect(toUrl(text)).toBe(url)
  })

  it.each([
    'hello',
    'hello world',
    'notes.md',
    'node.js',
    'javascript:alert(1)',
    'data:text/html,<b>x</b>',
    'mailto:me@example.com',
    'example.c0m',
    '-bad.com',
    '999.1.1.1',
    'a..b',
  ])('searches for %s', (text) => {
    expect(toUrl(text)).toBeNull()
  })
})
