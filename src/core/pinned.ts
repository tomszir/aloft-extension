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
