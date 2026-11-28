import { afterEach, describe, expect, it, vi } from 'vitest'
import { type Browser, browser } from 'wxt/browser'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { runAction } from './actions'
import { isBookmarked, loadTabs, loadWindows } from './sources'

const host = { id: 1, index: 0, windowId: 10 }
const target = { host, lastClosed: undefined }

const tab = (id: number, windowId: number, url: string, extra: Partial<Browser.tabs.Tab> = {}) =>
  ({
    id,
    windowId,
    index: id,
    url,
    title: `Tab ${id}`,
    pinned: false,
    active: false,
    status: 'complete',
    lastAccessed: id,
    ...extra,
  }) as Browser.tabs.Tab

const bookmark = (id: string, url: string) =>
  ({ id, title: url, url }) as Browser.bookmarks.BookmarkTreeNode

afterEach(() => {
  vi.restoreAllMocks()
  fakeBrowser.reset()
})

describe('runAction', () => {
  it('closes the tab, which takes the palette with it', async () => {
    const remove = vi.spyOn(browser.tabs, 'remove').mockImplementation(async () => undefined)
    expect(await runAction('close-tab', target)).toBe(true)
    expect(remove).toHaveBeenCalledWith(1)
  })

  it('reloads the tab, which takes the palette with it', async () => {
    const reload = vi.spyOn(browser.tabs, 'reload').mockImplementation(async () => undefined)
    expect(await runAction('reload', target)).toBe(true)
    expect(reload).toHaveBeenCalledWith(1)
  })

  it('mutes and unmutes the tab, and the palette then closes itself', async () => {
    const update = vi
      .spyOn(browser.tabs, 'update')
      .mockImplementation(async () => tab(1, 10, 'https://a.test/'))
    expect(await runAction('mute', target)).toBe(false)
    expect(update).toHaveBeenLastCalledWith(1, { muted: true })
    await runAction('unmute', target)
    expect(update).toHaveBeenLastCalledWith(1, { muted: false })
  })

  it('bookmarks the page under its title', async () => {
    vi.spyOn(browser.tabs, 'get').mockImplementation(async () => tab(1, 10, 'https://a.test/'))
    const create = vi
      .spyOn(browser.bookmarks, 'create')
      .mockImplementation(async () => bookmark('1', 'https://a.test/'))
    await runAction('bookmark', target)
    expect(create).toHaveBeenCalledWith({ title: 'Tab 1', url: 'https://a.test/' })
  })

  it('removes every bookmark of the page', async () => {
    vi.spyOn(browser.tabs, 'get').mockImplementation(async () => tab(1, 10, 'https://a.test/'))
    const search = vi
      .spyOn(browser.bookmarks, 'search')
      .mockImplementation(async () => [
        bookmark('4', 'https://a.test/'),
        bookmark('9', 'https://a.test/'),
      ])
    const remove = vi.spyOn(browser.bookmarks, 'remove').mockImplementation(async () => undefined)
    await runAction('remove-bookmark', target)
    expect(search).toHaveBeenCalledWith({ url: 'https://a.test/' })
    expect(remove.mock.calls).toEqual([['4'], ['9']])
  })

  it("closes the window's duplicates but never the tab you're on", async () => {
    vi.spyOn(browser.tabs, 'query').mockImplementation(async () => [
      tab(1, 10, 'https://a.test/'),
      tab(2, 10, 'https://a.test/#more'),
      tab(3, 10, 'https://b.test/'),
      tab(4, 20, 'https://a.test/'),
    ])
    const remove = vi.spyOn(browser.tabs, 'remove').mockImplementation(async () => undefined)
    expect(await runAction('close-duplicate-tabs', target)).toBe(false)
    expect(remove).toHaveBeenCalledWith([2])
  })

  it('moves the tab to the end of another window and follows it there', async () => {
    const move = vi
      .spyOn(browser.tabs, 'move')
      .mockImplementation(async () => tab(1, 20, 'https://a.test/'))
    const update = vi
      .spyOn(browser.tabs, 'update')
      .mockImplementation(async () => tab(1, 20, 'https://a.test/'))
    const focus = vi
      .spyOn(browser.windows, 'update')
      .mockImplementation(async () => ({}) as Browser.windows.Window)
    await runAction('move-to-window', { ...target, windowId: 20 })
    expect(move).toHaveBeenCalledWith(1, { windowId: 20, index: -1 })
    expect(update).toHaveBeenCalledWith(1, { active: true })
    expect(focus).toHaveBeenCalledWith(20, { focused: true })
  })
})

describe('loadTabs', () => {
  it('reports whether a tab plays sound and whether it is muted', async () => {
    vi.spyOn(browser.tabs, 'query').mockImplementation(async () => [
      tab(1, 10, 'https://a.test/', { audible: true, mutedInfo: { muted: true } }),
      tab(2, 10, 'https://b.test/'),
    ])
    const [loud, quiet] = await loadTabs()
    expect(loud).toMatchObject({ audible: true, muted: true })
    expect(quiet).toMatchObject({ audible: false, muted: false })
  })
})

describe('loadWindows', () => {
  it('names each window after its active tab and counts every tab, new tab pages included', async () => {
    vi.spyOn(browser.windows, 'getAll').mockImplementation(
      async () =>
        [
          {
            id: 10,
            incognito: false,
            tabs: [tab(1, 10, 'https://a.test/'), tab(2, 10, 'about:newtab', { active: true })],
          },
          { id: 20, incognito: true, tabs: [tab(3, 20, 'https://b.test/')] },
          { id: 30, incognito: false, tabs: [] },
        ] as Browser.windows.Window[],
    )
    expect(await loadWindows()).toEqual([
      { windowId: 10, title: 'Tab 2', tabCount: 2, incognito: false },
      { windowId: 20, title: 'Tab 3', tabCount: 1, incognito: true },
    ])
  })
})

describe('isBookmarked', () => {
  it('asks the browser for bookmarks of that exact address', async () => {
    const search = vi.spyOn(browser.bookmarks, 'search').mockImplementation(async () => [])
    expect(await isBookmarked('https://a.test/')).toBe(false)
    expect(search).toHaveBeenCalledWith({ url: 'https://a.test/' })
    search.mockImplementation(async () => [bookmark('1', 'https://a.test/')])
    expect(await isBookmarked('https://a.test/')).toBe(true)
  })

  it("is false for addresses the bookmarks API won't take", async () => {
    vi.spyOn(browser.bookmarks, 'search').mockRejectedValue(new Error('Invalid URL'))
    expect(await isBookmarked('chrome://newtab/')).toBe(false)
  })
})
