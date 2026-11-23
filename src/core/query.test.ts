import { describe, expect, it } from 'vitest'
import { parseQuery, toUrl } from './query'

describe('parseQuery', () => {
  it('treats whitespace as empty', () => {
    expect(parseQuery('   ')).toEqual({ kind: 'empty' })
  })

  it('switches to actions with >', () => {
    expect(parseQuery('> pin ')).toEqual({ kind: 'actions', text: 'pin' })
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
