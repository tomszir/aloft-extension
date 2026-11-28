import { describe, expect, it } from 'vitest'
import {
  type ActionContext,
  availableActions,
  BROWSER_PAGE_IDS,
  duplicateTabs,
  otherWindows,
} from './actions'

const over: ActionContext = {
  overPage: true,
  hostPinned: false,
  hostAudible: false,
  hostMuted: false,
  hostBookmarked: false,
  otherTabsInWindow: 3,
  otherUnpinnedTabs: 2,
  duplicateTabs: 0,
  otherWindows: 0,
  hasRecentlyClosed: true,
  browserPages: true,
}

describe('availableActions', () => {
  it('offers everything over a normal page', () => {
    expect(availableActions(over)).toEqual([
      'pin',
      'duplicate',
      'reload',
      'bookmark',
      'move-to-new-window',
      'close-tab',
      'close-other-tabs',
      'new-tab',
      'new-window',
      'reopen-closed-tab',
      ...BROWSER_PAGE_IDS,
      'open-settings',
    ])
  })

  it('offers unpin instead of pin on a pinned tab', () => {
    const actions = availableActions({ ...over, hostPinned: true })
    expect(actions).toContain('unpin')
    expect(actions).not.toContain('pin')
  })

  it('leaves out actions that need other tabs when this is the only one', () => {
    const actions = availableActions({ ...over, otherTabsInWindow: 0, otherUnpinnedTabs: 0 })
    expect(actions).not.toContain('move-to-new-window')
    expect(actions).not.toContain('close-other-tabs')
  })

  it('has nothing to close when the only other tabs are pins', () => {
    const actions = availableActions({ ...over, otherUnpinnedTabs: 0 })
    expect(actions).toContain('move-to-new-window')
    expect(actions).not.toContain('close-other-tabs')
  })

  it('only offers page-free actions on its own pages', () => {
    expect(availableActions({ ...over, overPage: false })).toEqual([
      'new-tab',
      'new-window',
      'reopen-closed-tab',
      ...BROWSER_PAGE_IDS,
      'open-settings',
    ])
  })

  it("leaves out the browser's own pages where it can't open them", () => {
    const actions = availableActions({ ...over, browserPages: false })
    for (const page of BROWSER_PAGE_IDS) expect(actions).not.toContain(page)
    expect(actions).toContain('open-settings')
  })

  it('hides reopen when nothing was closed', () => {
    expect(availableActions({ ...over, hasRecentlyClosed: false })).not.toContain(
      'reopen-closed-tab',
    )
  })

  it('offers to remove the bookmark of a bookmarked page instead of adding one', () => {
    const actions = availableActions({ ...over, hostBookmarked: true })
    expect(actions).toContain('remove-bookmark')
    expect(actions).not.toContain('bookmark')
  })

  it('offers mute only while the tab plays sound, and unmute whenever it is muted', () => {
    expect(availableActions(over)).not.toContain('mute')
    expect(availableActions(over)).not.toContain('unmute')
    expect(availableActions({ ...over, hostAudible: true })).toContain('mute')
    const muted = availableActions({ ...over, hostAudible: true, hostMuted: true })
    expect(muted).toContain('unmute')
    expect(muted).not.toContain('mute')
    expect(availableActions({ ...over, hostMuted: true })).toContain('unmute')
  })

  it('offers closing duplicates only when there are some', () => {
    expect(availableActions(over)).not.toContain('close-duplicate-tabs')
    expect(availableActions({ ...over, duplicateTabs: 2 })).toContain('close-duplicate-tabs')
  })

  it('offers moving to another window only when there is one', () => {
    expect(availableActions(over)).not.toContain('move-to-window')
    expect(availableActions({ ...over, otherWindows: 1 })).toContain('move-to-window')
  })

  it('leaves the tab-only actions out on its own pages', () => {
    const actions = availableActions({
      ...over,
      overPage: false,
      hostAudible: true,
      hostMuted: true,
      hostBookmarked: true,
      duplicateTabs: 2,
      otherWindows: 1,
    })
    for (const id of [
      'reload',
      'close-tab',
      'bookmark',
      'remove-bookmark',
      'mute',
      'unmute',
      'close-duplicate-tabs',
      'move-to-window',
    ] as const)
      expect(actions).not.toContain(id)
  })
})

describe('duplicateTabs', () => {
  const host = { id: 1, windowId: 1 }
  const tab = (
    tabId: number,
    url: string,
    extra: { pinned?: boolean; windowId?: number; lastAccessed?: number } = {},
  ) => ({
    tabId,
    url,
    windowId: extra.windowId ?? 1,
    pinned: extra.pinned ?? false,
    lastAccessed: extra.lastAccessed ?? tabId,
  })

  it('finds nothing when every page is open once', () => {
    expect(duplicateTabs([tab(1, 'https://a.test/'), tab(2, 'https://b.test/')], host)).toEqual([])
  })

  it('keeps the tab you are on and closes its copies, ignoring the fragment and a trailing slash', () => {
    const tabs = [
      tab(1, 'https://a.test/page'),
      tab(2, 'https://a.test/page#top'),
      tab(3, 'https://a.test/page/'),
      tab(4, 'https://a.test/other'),
    ]
    expect(duplicateTabs(tabs, host)).toEqual([2, 3])
  })

  it('keeps the most recently used copy of other pages', () => {
    const tabs = [
      tab(1, 'https://host.test/'),
      tab(2, 'https://a.test/', { lastAccessed: 50 }),
      tab(3, 'https://a.test/', { lastAccessed: 90 }),
      tab(4, 'https://a.test/', { lastAccessed: 10 }),
    ]
    expect(duplicateTabs(tabs, host)).toEqual([2, 4])
  })

  it('never closes a pin, and lets a pin be the copy that stays', () => {
    const tabs = [
      tab(1, 'https://host.test/'),
      tab(2, 'https://a.test/', { pinned: true }),
      tab(3, 'https://a.test/', { pinned: true }),
      tab(4, 'https://a.test/', { lastAccessed: 99 }),
    ]
    expect(duplicateTabs(tabs, host)).toEqual([4])
  })

  it('leaves other windows alone', () => {
    const tabs = [
      tab(1, 'https://a.test/'),
      tab(2, 'https://a.test/', { windowId: 2 }),
      tab(3, 'https://b.test/', { windowId: 2 }),
      tab(4, 'https://b.test/', { windowId: 2 }),
    ]
    expect(duplicateTabs(tabs, host)).toEqual([])
  })
})

describe('otherWindows', () => {
  const win = (windowId: number, incognito = false) => ({
    windowId,
    title: `Window ${windowId}`,
    tabCount: 2,
    incognito,
  })

  it('lists the other windows of the same kind as the host', () => {
    const windows = [win(1), win(2), win(3, true)]
    expect(otherWindows(windows, 1).map((w) => w.windowId)).toEqual([2])
    expect(otherWindows([...windows, win(4, true)], 3).map((w) => w.windowId)).toEqual([4])
  })

  it('lists nothing while the host window is unknown', () => {
    expect(otherWindows([win(2)], 1)).toEqual([])
  })
})
