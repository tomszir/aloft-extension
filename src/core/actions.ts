export type ActionId =
  | 'pin'
  | 'unpin'
  | 'duplicate'
  | 'new-window'
  | 'move-to-new-window'
  | 'close-other-tabs'
  | 'reopen-closed-tab'

/** Already translated by the caller, since core can't reach the i18n API. */
export interface ActionEntry {
  id: ActionId
  label: string
  /** Extra words to match on, so "> undo" finds "Reopen closed tab". */
  keywords: string
  /** The browser's own shortcut, shown as a reminder; empty when there is none. */
  hint: string
}

export interface ActionContext {
  /** False on Aloft's own pages, where there is no page tab to act on. */
  overPage: boolean
  hostPinned: boolean
  otherTabsInWindow: number
  /** "Close other tabs" leaves pins alone, so only these count for it. */
  otherUnpinnedTabs: number
  hasRecentlyClosed: boolean
}

const ORDER: readonly ActionId[] = [
  'pin',
  'unpin',
  'duplicate',
  'move-to-new-window',
  'close-other-tabs',
  'new-window',
  'reopen-closed-tab',
]

export function availableActions(context: ActionContext): ActionId[] {
  const { overPage, hostPinned, otherTabsInWindow, otherUnpinnedTabs, hasRecentlyClosed } = context
  const available: Record<ActionId, boolean> = {
    pin: overPage && !hostPinned,
    unpin: overPage && hostPinned,
    duplicate: overPage,
    // Moving the only tab would just leave an empty window behind.
    'move-to-new-window': overPage && otherTabsInWindow > 0,
    'close-other-tabs': overPage && otherUnpinnedTabs > 0,
    'new-window': true,
    'reopen-closed-tab': hasRecentlyClosed,
  }
  return ORDER.filter((id) => available[id])
}
