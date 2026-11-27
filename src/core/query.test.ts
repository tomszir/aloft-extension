import { describe, expect, it } from 'vitest'
import { builtInKeyword, resolveKeywords } from './keywords'
import {
  applyInput,
  EMPTY_QUERY,
  enterKeyword,
  leaveChip,
  listedKeywords,
  offeredKeyword,
  parseQuery,
  replayTyped,
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
    expect(offeredKeyword(enterKeyword(youtube), keywords)).toBeUndefined()
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
    expect(leaveChip(enterKeyword(youtube))).toEqual({ chip: null, text: 'yt' })
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
    expect(replayTyped(enterKeyword(youtube), '@', keywords)).toEqual({ chip: youtube, text: '' })
    expect(replayTyped({ chip: 'actions', text: 'pin' }, '')).toEqual({
      chip: 'actions',
      text: 'pin',
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
