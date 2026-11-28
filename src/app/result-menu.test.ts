import { describe, expect, it, vi } from 'vitest'
import type { WindowEntry } from '../core/actions'
import type { Result, TabEntry } from '../core/results'
import { type ResultMenuHandlers, resultMenu } from './result-menu'

const tab: TabEntry = {
  tabId: 2,
  windowId: 1,
  index: 3,
  pinned: false,
  loaded: true,
  title: 'Docs',
  url: 'https://docs.test/',
  lastAccessed: 0,
}
const tabRow: Result = {
  kind: 'tab',
  id: 'tab:2',
  tabId: 2,
  windowId: 1,
  title: 'Docs',
  url: 'https://docs.test/',
}
const windows: WindowEntry[] = [
  { windowId: 1, title: 'Docs', tabCount: 3, incognito: false },
  { windowId: 2, title: 'Mail', tabCount: 1, incognito: false },
  { windowId: 3, title: 'Private', tabCount: 1, incognito: true },
]

const handlers = (): ResultMenuHandlers => ({
  open: vi.fn(),
  close: vi.fn(),
  act: vi.fn(),
  copy: vi.fn(),
  forget: vi.fn(),
})
const labels = (items: { label: string }[]) => items.map((i) => i.label)
const pick = (items: { label: string; run: () => void }[], label: string, index = 0) =>
  items.filter((i) => i.label === label)[index]?.run()

describe('resultMenu', () => {
  it('offers an open tab switch, moves, pin, mute, copy and close', () => {
    expect(labels(resultMenu(tabRow, [tab], windows, handlers()))).toEqual([
      'actionSwitch',
      'actionMoveToNewWindow',
      // Only the ordinary window: a tab can't move into a private one.
      'actionMoveToWindow',
      'actionPin',
      'actionMute',
      'menuCopyAddress',
      'actionCloseTab',
    ])
  })

  it('offers unpin and unmute for a pinned, muted tab, and no new window for a lone tab', () => {
    const lone = windows.map((w) => (w.windowId === 1 ? { ...w, tabCount: 1 } : w))
    const items = resultMenu(tabRow, [{ ...tab, pinned: true, muted: true }], lone, handlers())
    expect(labels(items)).toContain('actionUnpin')
    expect(labels(items)).toContain('actionUnmute')
    expect(labels(items)).not.toContain('actionMoveToNewWindow')
  })

  it("acts on the row's own tab", () => {
    const on = handlers()
    const items = resultMenu(tabRow, [tab], windows, on)
    pick(items, 'actionMoveToWindow')
    expect(on.act).toHaveBeenCalledWith('move-to-window', tab, 2)
    pick(items, 'actionPin')
    expect(on.act).toHaveBeenLastCalledWith('pin', tab, undefined)
    pick(items, 'menuCopyAddress')
    expect(on.copy).toHaveBeenCalledWith('https://docs.test/')
    pick(items, 'actionCloseTab')
    expect(on.close).toHaveBeenCalledWith(tabRow)
  })

  it('offers nothing for a tab that has since closed', () => {
    expect(resultMenu(tabRow, [], windows, handlers())).toEqual([])
  })

  it('opens history in a new tab or this one, copies it, or removes it from history', () => {
    const on = handlers()
    const row: Result = { kind: 'history', id: 'history:x', title: 'X', url: 'https://x.test/' }
    const items = resultMenu(row, [], windows, on)
    expect(labels(items)).toEqual([
      'menuOpenNewTab',
      'menuOpenHere',
      'menuCopyAddress',
      'menuRemoveFromHistory',
    ])
    pick(items, 'menuOpenNewTab')
    expect(on.open).toHaveBeenCalledWith(row, 'new-tab')
    pick(items, 'menuOpenHere')
    expect(on.open).toHaveBeenLastCalledWith(row, 'current-tab')
    pick(items, 'menuRemoveFromHistory')
    expect(on.forget).toHaveBeenCalledWith('https://x.test/')
  })

  it('opens or copies a bookmark, and restores or copies a closed tab', () => {
    const bookmark: Result = {
      kind: 'bookmark',
      id: 'bookmark:1',
      title: 'B',
      url: 'https://b.test/',
    }
    expect(labels(resultMenu(bookmark, [], windows, handlers()))).toEqual([
      'menuOpenNewTab',
      'menuOpenHere',
      'menuCopyAddress',
    ])
    const closed: Result = {
      kind: 'closed',
      id: 'closed:1',
      sessionId: '1',
      title: 'C',
      url: 'https://c.test/',
    }
    expect(labels(resultMenu(closed, [], windows, handlers()))).toEqual([
      'actionRestore',
      'menuCopyAddress',
    ])
  })

  it('has no menu for searches, addresses and actions', () => {
    const search: Result = { kind: 'search', id: 'search', query: 'q' }
    expect(resultMenu(search, [], windows, handlers())).toEqual([])
  })
})
