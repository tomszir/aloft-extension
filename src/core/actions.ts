import { pageKey } from './url'

export type ActionId =
  | 'pin'
  | 'unpin'
  | 'duplicate'
  | 'reload'
  | 'bookmark'
  | 'remove-bookmark'
  | 'mute'
  | 'unmute'
  | 'new-tab'
  | 'new-window'
  | 'move-to-new-window'
  | 'move-to-window'
  | 'close-tab'
  | 'close-other-tabs'
  | 'close-duplicate-tabs'
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
  /** The window "Move tab to window" moves to; one entry per window. */
  windowId?: number
}

/** A window a tab could move to, named after the tab showing in it. */
export interface WindowEntry {
  windowId: number
  title: string
  tabCount: number
  /** Tabs can't move between private and ordinary windows. */
  incognito: boolean
}

export interface ActionContext {
  /** False on Aloft's own pages, where there is no page tab to act on. */
  overPage: boolean
  hostPinned: boolean
  /** Playing sound; a muted tab can be too. */
  hostAudible: boolean
  hostMuted: boolean
  hostBookmarked: boolean
  otherTabsInWindow: number
  /** "Close other tabs" leaves pins alone, so only these count for it. */
  otherUnpinnedTabs: number
  /** What "Close duplicate tabs" would close (`duplicateTabs`). */
  duplicateTabs: number
  /** Windows the tab could move to (`otherWindows`). */
  otherWindows: number
  hasRecentlyClosed: boolean
  /** Whether this browser lets an extension open its own pages. */
  browserPages: boolean
}

const ORDER: readonly ActionId[] = [
  'pin',
  'unpin',
  'duplicate',
  'reload',
  'bookmark',
  'remove-bookmark',
  'mute',
  'unmute',
  'move-to-new-window',
  'move-to-window',
  'close-tab',
  'close-other-tabs',
  'close-duplicate-tabs',
  'new-tab',
  'new-window',
  'reopen-closed-tab',
  ...BROWSER_PAGE_IDS,
  'open-settings',
]

export function availableActions(context: ActionContext): ActionId[] {
  const { overPage, hostPinned, hostMuted, hostBookmarked, otherTabsInWindow } = context
  const available: Record<Exclude<ActionId, BrowserPageId>, boolean> = {
    pin: overPage && !hostPinned,
    unpin: overPage && hostPinned,
    duplicate: overPage,
    reload: overPage,
    bookmark: overPage && !hostBookmarked,
    'remove-bookmark': overPage && hostBookmarked,
    // Unmute wins: a muted tab that plays still can't be heard.
    mute: overPage && context.hostAudible && !hostMuted,
    unmute: overPage && hostMuted,
    // Moving the only tab would just leave an empty window behind.
    'move-to-new-window': overPage && otherTabsInWindow > 0,
    'move-to-window': overPage && context.otherWindows > 0,
    'close-tab': overPage,
    'close-other-tabs': overPage && context.otherUnpinnedTabs > 0,
    'close-duplicate-tabs': overPage && context.duplicateTabs > 0,
    // Ctrl+T may open Aloft instead, so an empty tab is always one action away.
    'new-tab': true,
    'new-window': true,
    'reopen-closed-tab': context.hasRecentlyClosed,
    'open-settings': true,
  }
  return ORDER.filter((id) => (isBrowserPage(id) ? context.browserPages : available[id]))
}

interface TabLike {
  tabId: number
  windowId: number
  pinned: boolean
  url: string
  lastAccessed: number
}

/**
 * The tabs "Close duplicate tabs" closes: in the host's window, every tab
 * showing a page another tab there shows too, by address with the #fragment
 * and a trailing slash ignored. Other windows are left alone, as "Close other
 * tabs" leaves them. Of each page's copies the tab you're on stays, and pins
 * always do; otherwise the most recently used copy stays.
 */
export function duplicateTabs(tabs: readonly TabLike[], host: { id: number; windowId: number }) {
  const byPage = new Map<string, TabLike[]>()
  for (const tab of tabs) {
    if (tab.windowId !== host.windowId) continue
    const key = pageKey(tab.url)
    byPage.set(key, [...(byPage.get(key) ?? []), tab])
  }
  const kept = (t: TabLike) => t.tabId === host.id || t.pinned
  return [...byPage.values()].flatMap((copies) => {
    const keep = copies.some(kept)
      ? undefined
      : copies.reduce((a, b) => (b.lastAccessed > a.lastAccessed ? b : a))
    return copies.filter((t) => t !== keep && !kept(t)).map((t) => t.tabId)
  })
}

/** Windows of the same kind (private or not) as the host's, other than the host's own. */
export const otherWindows = (windows: readonly WindowEntry[], hostWindowId: number) => {
  const host = windows.find((w) => w.windowId === hostWindowId)
  return host
    ? windows.filter((w) => w.windowId !== hostWindowId && w.incognito === host.incognito)
    : []
}
