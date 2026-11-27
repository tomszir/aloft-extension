import { describe, expect, it, vi } from 'vitest'
import { pinnedRow } from '../core/pinned'
import { DemoBrowser } from './browser-state'
import { CLOSED, PINS, TABS } from './sites'

const make = () => new DemoBrowser(() => 1_000_000_000)
const titles = (browser: DemoBrowser) => browser.tabs().map((t) => t.title)
const pinTitles = (browser: DemoBrowser) =>
  pinnedRow(browser.tabs(), browser.host().windowId).map((t) => t.title)

describe('DemoBrowser', () => {
  it('starts with the invented pins and tabs, on the first unpinned one', () => {
    const browser = make()
    expect(titles(browser)).toEqual([...PINS, ...TABS].map((s) => s.title))
    expect(pinTitles(browser)).toEqual(PINS.map((s) => s.title))
    const host = browser.tabs().find((t) => t.tabId === browser.host().id)
    expect(host?.title).toBe(TABS[0]?.title)
    expect(browser.host().index).toBe(PINS.length)
    expect(browser.recentlyClosed().map((c) => c.title)).toEqual([CLOSED.title])
  })

  it('pins a tab at the end of the pins, and unpins it to just after them', () => {
    const browser = make()
    const host = browser.host().id
    browser.setPinned(host, true)
    expect(pinTitles(browser).at(-1)).toBe(TABS[0]?.title)
    browser.setPinned(host, false)
    expect(titles(browser)[PINS.length]).toBe(TABS[0]?.title)
    expect(pinTitles(browser)).toEqual(PINS.map((s) => s.title))
  })

  it('closes a tab into recently closed, and reopens it', () => {
    const browser = make()
    const docs = browser.tabs().find((t) => t.title === TABS[1]?.title)
    if (!docs) throw new Error('missing tab')
    browser.close(docs.tabId)
    expect(titles(browser)).not.toContain(docs.title)
    const [last] = browser.recentlyClosed()
    expect(last?.title).toBe(docs.title)
    browser.restore(last?.sessionId ?? '')
    expect(titles(browser)).toContain(docs.title)
    expect(browser.recentlyClosed().map((c) => c.title)).toEqual([CLOSED.title])
  })

  it('never closes the page the demo sits on', () => {
    const browser = make()
    browser.close(browser.host().id)
    expect(titles(browser)).toContain(TABS[0]?.title)
  })

  it('closes the other tabs but keeps the pins', () => {
    const browser = make()
    browser.closeOthers(browser.host().id)
    expect(titles(browser)).toEqual([...PINS, TABS[0]].map((s) => s?.title))
    expect(browser.recentlyClosed()).toHaveLength(1 + TABS.length - 1)
  })

  it('duplicates a tab next to it', () => {
    const browser = make()
    browser.duplicate(browser.host().id)
    expect(titles(browser).filter((t) => t === TABS[0]?.title)).toHaveLength(2)
    expect(titles(browser)[PINS.length + 1]).toBe(TABS[0]?.title)
  })

  it('moves a pin only among the pins', () => {
    const browser = make()
    const first = browser.tabs()[0]
    if (!first) throw new Error('missing pin')
    browser.move(first.tabId, 99)
    expect(pinTitles(browser).at(-1)).toBe(first.title)
    expect(pinTitles(browser)).toHaveLength(PINS.length)
  })

  it('opens a page in a new tab and remembers the visit', () => {
    const browser = make()
    browser.openTab('https://maps.aloft.test/coffee', 'Coffee near the station — Waypoint')
    expect(titles(browser)[PINS.length + 1]).toBe('Coffee near the station — Waypoint')
    expect(browser.recentHistory()[0]?.url).toBe('https://maps.aloft.test/coffee')
  })

  it('wakes a sleeping pin when switched to', () => {
    const browser = make()
    const asleep = browser.tabs().find((t) => !t.loaded)
    if (!asleep) throw new Error('expected a sleeping pin')
    expect(browser.focus(asleep.tabId)?.loaded).toBe(true)
  })

  it('searches history and bookmarks by every word, like the browser', () => {
    const browser = make()
    expect(browser.searchHistory('handbook guide').map((h) => h.title)).toEqual([
      'Onboarding guide — Handbook',
      'Writing style guide — Handbook',
    ])
    expect(browser.searchBookmarks('handbook').map((b) => b.title)).toEqual([
      'Keyboard shortcuts reference — Handbook',
      'Team handbook — Handbook',
    ])
    expect(browser.searchBookmarks('')).toEqual([])
  })

  it('finds an open tab for a page, but not the host', () => {
    const browser = make()
    expect(browser.openTabFor('https://maps.aloft.test/#here')?.title).toBe(TABS[2]?.title)
    expect(browser.openTabFor('https://notes.aloft.test/')).toBeUndefined()
  })

  it('tells its listeners about every change, until they stop listening', () => {
    const browser = make()
    const listener = vi.fn()
    const stop = browser.onChange(listener)
    browser.setPinned(browser.host().id, true)
    browser.duplicate(browser.host().id)
    expect(listener).toHaveBeenCalledTimes(2)
    stop()
    browser.closeOthers(browser.host().id)
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
