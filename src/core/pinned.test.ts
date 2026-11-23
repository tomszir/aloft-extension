import { describe, expect, it } from 'vitest'
import { moveIndex, pinnedRow, shortcutSlot } from './pinned'
import type { TabEntry } from './results'

const tab = (tabId: number, windowId: number, index: number, pinned: boolean): TabEntry => ({
  tabId,
  windowId,
  index,
  pinned,
  loaded: true,
  title: `Tab ${tabId}`,
  url: `https://t.test/${tabId}`,
  lastAccessed: 0,
})

const tabs = [
  tab(3, 1, 2, true),
  tab(1, 1, 0, true),
  tab(9, 2, 0, true),
  tab(2, 1, 1, true),
  tab(4, 1, 3, false),
]

describe('pinnedRow', () => {
  it("keeps only this window's pins, in tab-strip order", () => {
    expect(pinnedRow(tabs, 1).map((t) => t.tabId)).toEqual([1, 2, 3])
    expect(pinnedRow(tabs, 2).map((t) => t.tabId)).toEqual([9])
    expect(pinnedRow(tabs, 3)).toEqual([])
  })
})

describe('shortcutSlot', () => {
  it('maps digit keys to slots', () => {
    expect(shortcutSlot('Digit1')).toBe(0)
    expect(shortcutSlot('Digit9')).toBe(8)
    expect(shortcutSlot('Numpad3')).toBe(2)
  })

  it('ignores 0 and other keys', () => {
    for (const code of ['Digit0', 'KeyA', 'Numpad0', '']) expect(shortcutSlot(code)).toBeUndefined()
  })
})

describe('moveIndex', () => {
  const row = pinnedRow(tabs, 1)

  it("returns the neighbour's index", () => {
    expect(moveIndex(row, 2, 'left')).toBe(0)
    expect(moveIndex(row, 2, 'right')).toBe(2)
  })

  it('stops at the ends of the row', () => {
    expect(moveIndex(row, 1, 'left')).toBeUndefined()
    expect(moveIndex(row, 3, 'right')).toBeUndefined()
    expect(moveIndex(row, 42, 'right')).toBeUndefined()
  })
})
