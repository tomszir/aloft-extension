import type { TabEntry } from './results'

export const MAX_SHORTCUTS = 9

/**
 * Pins of one window, in tab-strip order. Helium shares pins across windows as
 * separate tabs per window, so the host window's copies are the ones to show.
 */
export function pinnedRow(tabs: readonly TabEntry[], windowId: number): TabEntry[] {
  return tabs.filter((t) => t.pinned && t.windowId === windowId).sort((a, b) => a.index - b.index)
}

/**
 * Alt+1–9 by physical key, so it works on layouts where Alt+digit types a
 * symbol (macOS Option, AZERTY).
 */
export function shortcutSlot(code: string): number | undefined {
  const match = /^(?:Digit|Numpad)([1-9])$/.exec(code)
  return match ? Number(match[1]) - 1 : undefined
}

/** The tab-strip index to move a pin to, or undefined at either end of the row. */
export function moveIndex(
  row: readonly TabEntry[],
  tabId: number,
  direction: 'left' | 'right',
): number | undefined {
  const position = row.findIndex((t) => t.tabId === tabId)
  if (position === -1) return undefined
  const neighbour = row[position + (direction === 'left' ? -1 : 1)]
  return neighbour?.index
}

/** The tab-strip index that puts a pin at `position` in the row. */
export function dropIndex(row: readonly TabEntry[], position: number): number | undefined {
  return row[position]?.index
}

/** `items` with the one at `from` moved to `to`. */
export function reorder<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items]
  const [moved] = next.splice(from, 1)
  if (moved === undefined) return next
  next.splice(to, 0, moved)
  return next
}

export interface Cell {
  x: number
  y: number
  width: number
  height: number
}

/** The cell whose centre is nearest to (x, y). */
export function nearestCell(cells: readonly Cell[], x: number, y: number): number {
  let best = 0
  let bestDistance = Number.POSITIVE_INFINITY
  cells.forEach((cell, index) => {
    const distance = Math.hypot(cell.x + cell.width / 2 - x, cell.y + cell.height / 2 - y)
    if (distance < bestDistance) {
      best = index
      bestDistance = distance
    }
  })
  return best
}

/**
 * The row in a dropped order while the browser catches up. Tab events from
 * the move arrive one by one, so showing them as they come would flick the
 * dropped pin back first. Undefined once the browser's order matches, or
 * when the pins themselves changed and the held order no longer fits.
 */
export function heldOrder(
  pins: readonly TabEntry[],
  order: readonly number[],
): TabEntry[] | undefined {
  if (pins.length !== order.length) return undefined
  const byId = new Map(pins.map((pin) => [pin.tabId, pin]))
  const held: TabEntry[] = []
  for (const tabId of order) {
    const pin = byId.get(tabId)
    if (!pin) return undefined
    held.push(pin)
  }
  return held.every((pin, i) => pin.tabId === pins[i]?.tabId) ? undefined : held
}
