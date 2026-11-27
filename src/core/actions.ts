export type ActionId =
  | 'pin'
  | 'unpin'
  | 'duplicate'
  | 'new-tab'
  | 'new-window'
  | 'move-to-new-window'
  | 'close-other-tabs'
  | 'reopen-closed-tab'
  | BrowserPageId
  | 'open-settings'

/** The browser's own pages, each opened by an action of the same name. */
export const BROWSER_PAGE_IDS = [
  'history',
  'downloads',
  'bookmarks',
  'passwords',
  'extensions',
  'extension-shortcuts',
  'browser-settings',
  'clear-browsing-data',
] as const

export type BrowserPageId = (typeof BROWSER_PAGE_IDS)[number]

export const isBrowserPage = (id: ActionId): id is BrowserPageId =>
  (BROWSER_PAGE_IDS as readonly ActionId[]).includes(id)

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
  /** Whether this browser lets an extension open its own pages. */
  browserPages: boolean
}

const ORDER: readonly ActionId[] = [
  'pin',
  'unpin',
  'duplicate',
  'move-to-new-window',
  'close-other-tabs',
  'new-tab',
  'new-window',
  'reopen-closed-tab',
  ...BROWSER_PAGE_IDS,
  'open-settings',
]

export function availableActions(context: ActionContext): ActionId[] {
  const { overPage, hostPinned, otherTabsInWindow, otherUnpinnedTabs, hasRecentlyClosed } = context
  const available: Record<Exclude<ActionId, BrowserPageId>, boolean> = {
    pin: overPage && !hostPinned,
    unpin: overPage && hostPinned,
    duplicate: overPage,
    // Moving the only tab would just leave an empty window behind.
    'move-to-new-window': overPage && otherTabsInWindow > 0,
    'close-other-tabs': overPage && otherUnpinnedTabs > 0,
    // Ctrl+T may open Aloft instead, so an empty tab is always one action away.
    'new-tab': true,
    'new-window': true,
    'reopen-closed-tab': hasRecentlyClosed,
    'open-settings': true,
  }
  return ORDER.filter((id) => (isBrowserPage(id) ? context.browserPages : available[id]))
}
