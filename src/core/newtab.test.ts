import { describe, expect, it } from 'vitest'
import { isNewTabUrl, returnTab } from './newtab'

const OVERRIDE = 'chrome-extension://abc/newtab.html'

describe('isNewTabUrl', () => {
  it.each(['chrome://newtab/', 'helium://newtab/', OVERRIDE, `${OVERRIDE}?x`])(
    'recognises %s',
    (url) => {
      expect(isNewTabUrl(url, OVERRIDE)).toBe(true)
    },
  )

  it.each([undefined, '', 'https://example.com/', 'chrome://settings/', 'about:blank'])(
    'ignores %s',
    (url) => {
      expect(isNewTabUrl(url, OVERRIDE)).toBe(false)
    },
  )
})

describe('returnTab', () => {
  it('picks the most recently used tab other than the new one', () => {
    const tabs = [
      { id: 1, lastAccessed: 100 },
      { id: 2, lastAccessed: 300 },
      { id: 99, lastAccessed: 400 },
      { id: 3, lastAccessed: 200 },
    ]
    expect(returnTab(tabs, 99)).toBe(2)
  })

  it('has nothing to return to in a fresh window', () => {
    expect(returnTab([{ id: 99, lastAccessed: 1 }], 99)).toBeUndefined()
    expect(returnTab([], 99)).toBeUndefined()
  })
})
