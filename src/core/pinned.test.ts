import { describe, expect, it } from 'vitest'
import {
  dropIndex,
  heldOrder,
  moveIndex,
  nearestCell,
  pinnedRow,
  reorder,
  shortcutSlot,
} from './pinned'
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

describe('reorder', () => {
  it('moves one item to a new position', () => {
    expect(reorder(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(reorder(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
    expect(reorder(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
  })
})

describe('nearestCell', () => {
  const cells = [0, 1, 2].map((i) => ({ x: i * 100, y: 0, width: 90, height: 40 }))

  it('picks the cell whose centre is closest', () => {
    expect(nearestCell(cells, 10, 20)).toBe(0)
    expect(nearestCell(cells, 96, 20)).toBe(1)
    expect(nearestCell(cells, 400, 300)).toBe(2)
  })

  it('works across rows', () => {
    const grid = [...cells, { x: 0, y: 60, width: 90, height: 40 }]
    expect(nearestCell(grid, 40, 85)).toBe(3)
  })
})

describe('dropIndex', () => {
  it('is the tab-strip index of the pin now at that position', () => {
    const row = pinnedRow(tabs, 1)
    expect(dropIndex(row, 2)).toBe(2)
    expect(dropIndex(row, 0)).toBe(0)
    expect(dropIndex(row, 5)).toBeUndefined()
  })
})

describe('heldOrder', () => {
  const row = pinnedRow(tabs, 1)

  it('shows the dropped order until the browser reports it', () => {
    expect(heldOrder(row, [2, 1, 3])?.map((t) => t.tabId)).toEqual([2, 1, 3])
    expect(heldOrder(row, [1, 2, 3])).toBeUndefined()
  })

  it('lets go when pins were added or removed meanwhile', () => {
    expect(heldOrder(row, [2, 1])).toBeUndefined()
    expect(heldOrder(row, [2, 1, 7])).toBeUndefined()
  })
})
