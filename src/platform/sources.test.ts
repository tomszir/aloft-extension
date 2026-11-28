import { describe, expect, it, vi } from 'vitest'
import type { Browser } from 'wxt/browser'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { loadRecentlyClosed, loadTabs } from './sources'

const tab = (id: number, incognito: boolean): Browser.tabs.Tab =>
  ({
    id,
    index: 0,
    windowId: incognito ? 2 : 1,
    pinned: false,
    highlighted: false,
    active: false,
    incognito,
    status: 'complete',
    discarded: false,
    title: `Tab ${id}`,
    url: `https://example.com/${id}`,
    sessionId: `s${id}`,
  }) as Browser.tabs.Tab

describe('sources', () => {
  it('lists the tabs of normal windows, or only those of private ones', async () => {
    vi.spyOn(fakeBrowser.tabs, 'query').mockImplementation(async () => [
      tab(1, false),
      tab(2, true),
    ])
    expect((await loadTabs()).map((t) => t.tabId)).toEqual([1])
    expect((await loadTabs(true)).map((t) => t.tabId)).toEqual([2])
  })

  it('lists tabs closed in normal windows, or only those closed in private ones', async () => {
    vi.spyOn(fakeBrowser.sessions, 'getRecentlyClosed').mockImplementation(async () => [
      { lastModified: 0, tab: tab(1, false) },
      { lastModified: 0, tab: tab(2, true) },
    ])
    expect((await loadRecentlyClosed()).map((t) => t.sessionId)).toEqual(['s1'])
    expect((await loadRecentlyClosed(true)).map((t) => t.sessionId)).toEqual(['s2'])
  })
})
