import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type Browser, browser } from 'wxt/browser'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { watchNewTabs } from './newtab-intercept'
import { injectOverlay } from './overlay'

vi.mock('./overlay', () => ({ injectOverlay: vi.fn(async () => true) }))
vi.mock('./permissions', () => ({ hasSiteAccess: async () => true }))

const NEW_TAB_PAGE = browser.runtime.getURL('/newtab.html')

function tab(fields: Partial<Browser.tabs.Tab> & { id: number }): Browser.tabs.Tab {
  return {
    index: 0,
    windowId: 1,
    active: false,
    highlighted: false,
    pinned: false,
    incognito: false,
    frozen: false,
    selected: false,
    discarded: false,
    autoDiscardable: true,
    groupId: -1,
    lastAccessed: 0,
    ...fields,
  }
}

const PAGE_ID = 1

// Each test uses its own new tab id: the intercept remembers the tabs it has
// handled for as long as the module lives.
function openWindow(newTabId: number) {
  const page = tab({ id: PAGE_ID, url: 'https://example.com/', lastAccessed: 1 })
  const newTab = tab({ id: newTabId, index: 1, active: true, url: 'about:blank', lastAccessed: 2 })
  vi.spyOn(browser.tabs, 'query').mockImplementation(async () => [page, newTab])
  vi.spyOn(browser.tabs, 'update').mockImplementation(async () => page)
  vi.spyOn(browser.tabs, 'remove').mockImplementation(async () => {})
  return { pageId: PAGE_ID, newTabId, newTab }
}

// The intercept runs from event listeners without returning a promise.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('watchNewTabs', () => {
  beforeEach(() => {
    vi.mocked(injectOverlay).mockClear()
    watchNewTabs()
  })

  it('draws over the previous tab once when the new tab page is known at creation', async () => {
    const { pageId, newTabId, newTab } = openWindow(2)
    const created = { ...newTab, pendingUrl: NEW_TAB_PAGE }

    await fakeBrowser.tabs.onCreated.trigger(created)
    await fakeBrowser.tabs.onUpdated.trigger(newTabId, { url: NEW_TAB_PAGE }, created)
    await settle()

    expect(injectOverlay).toHaveBeenCalledTimes(1)
    expect(injectOverlay).toHaveBeenCalledWith(pageId)
    expect(browser.tabs.remove).toHaveBeenCalledTimes(1)
  })

  it('draws over the previous tab when the address only arrives in an update', async () => {
    const { pageId, newTabId, newTab } = openWindow(3)

    await fakeBrowser.tabs.onCreated.trigger(newTab)
    await settle()
    expect(injectOverlay).not.toHaveBeenCalled()

    const loaded = { ...newTab, url: NEW_TAB_PAGE }
    await fakeBrowser.tabs.onUpdated.trigger(newTabId, { url: NEW_TAB_PAGE }, loaded)
    await settle()

    expect(injectOverlay).toHaveBeenCalledTimes(1)
    expect(injectOverlay).toHaveBeenCalledWith(pageId)
  })

  it('leaves tabs that navigate somewhere else alone', async () => {
    const { newTabId, newTab } = openWindow(4)
    const elsewhere = { ...newTab, url: 'https://example.org/' }

    await fakeBrowser.tabs.onUpdated.trigger(newTabId, { url: elsewhere.url }, elsewhere)
    await settle()

    expect(injectOverlay).not.toHaveBeenCalled()
  })
})
