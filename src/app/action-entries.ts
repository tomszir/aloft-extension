import { i18n } from '#i18n'
import type { ActionEntry, ActionId, WindowEntry } from '../core/actions'

// Keywords stay English on purpose: they're extra ways in, on top of the
// translated label, which is always matched too.
const KEYWORDS: Record<ActionId, string> = {
  pin: 'pin essential keep',
  unpin: 'unpin remove',
  duplicate: 'copy clone',
  reload: 'reload refresh',
  bookmark: 'bookmark star save favorite',
  'remove-bookmark': 'bookmark unbookmark unstar delete remove',
  mute: 'mute sound audio silence quiet',
  unmute: 'unmute sound audio',
  'move-to-window': 'window move send',
  'close-tab': 'close tab',
  'close-duplicate-tabs': 'close tabs duplicates dedupe clean',
  'new-tab': 'tab open blank empty',
  'new-window': 'window open',
  'move-to-new-window': 'window detach split',
  'close-other-tabs': 'close tabs others clean',
  'reopen-closed-tab': 'restore undo closed',
  history: 'history visited past pages',
  downloads: 'downloads files',
  bookmarks: 'bookmarks manager favorites',
  passwords: 'passwords password manager logins keys autofill',
  extensions: 'extensions addons add-ons plugins',
  'extension-shortcuts': 'extensions shortcuts keyboard keys hotkeys',
  'browser-settings': 'settings preferences options browser',
  'clear-browsing-data': 'clear browsing data cache cookies delete privacy',
  'open-settings': 'settings preferences options theme aloft',
}

const LABEL: Record<ActionId, () => string> = {
  pin: () => i18n.t('actionPin'),
  unpin: () => i18n.t('actionUnpin'),
  duplicate: () => i18n.t('actionDuplicate'),
  reload: () => i18n.t('actionReload'),
  bookmark: () => i18n.t('actionBookmark'),
  'remove-bookmark': () => i18n.t('actionRemoveBookmark'),
  mute: () => i18n.t('actionMute'),
  unmute: () => i18n.t('actionUnmute'),
  'move-to-window': () => i18n.t('actionMoveToOtherWindow'),
  'close-tab': () => i18n.t('actionCloseTab'),
  'close-duplicate-tabs': () => i18n.t('actionCloseDuplicateTabs'),
  'new-tab': () => i18n.t('actionNewTab'),
  'new-window': () => i18n.t('actionNewWindow'),
  'move-to-new-window': () => i18n.t('actionMoveToNewWindow'),
  'close-other-tabs': () => i18n.t('actionCloseOtherTabs'),
  'reopen-closed-tab': () => i18n.t('actionReopenClosedTab'),
  history: () => i18n.t('actionHistory'),
  downloads: () => i18n.t('actionDownloads'),
  bookmarks: () => i18n.t('actionBookmarks'),
  passwords: () => i18n.t('actionPasswords'),
  extensions: () => i18n.t('actionExtensions'),
  'extension-shortcuts': () => i18n.t('actionExtensionShortcuts'),
  'browser-settings': () => i18n.t('actionBrowserSettings'),
  'clear-browsing-data': () => i18n.t('actionClearBrowsingData'),
  'open-settings': () => i18n.t('actionOpenSettings'),
}

// The OS, not the browser, decides how shortcuts are written. The page
// shortcuts are Chromium's; Firefox doesn't offer those actions. The tab's
// own (close, reload, bookmark) are the same in both.
const isMac = /mac/i.test(navigator.platform)

const HINT: Partial<Record<ActionId, string>> = isMac
  ? {
      'close-tab': '⌘W',
      reload: '⌘R',
      bookmark: '⌘D',
      'new-window': '⌘N',
      'reopen-closed-tab': '⇧⌘T',
      history: '⌘Y',
      downloads: '⌥⌘L',
      bookmarks: '⌥⌘B',
      'clear-browsing-data': '⇧⌘⌫',
    }
  : {
      'close-tab': 'Ctrl+W',
      reload: 'Ctrl+R',
      bookmark: 'Ctrl+D',
      'new-window': 'Ctrl+N',
      'reopen-closed-tab': 'Ctrl+Shift+T',
      history: 'Ctrl+H',
      downloads: 'Ctrl+J',
      bookmarks: 'Ctrl+Shift+O',
      'clear-browsing-data': 'Ctrl+Shift+Delete',
    }

/** `windows` are where "Move tab to window" can go, each its own entry. */
export function actionEntries(
  ids: readonly ActionId[],
  windows: readonly WindowEntry[] = [],
): ActionEntry[] {
  return ids.flatMap((id) => {
    const entry = { id, label: LABEL[id](), keywords: KEYWORDS[id], hint: HINT[id] ?? '' }
    if (id !== 'move-to-window') return [entry]
    return windows.map((w) => ({
      ...entry,
      label: i18n.t('actionMoveToWindow', w.tabCount, [w.title, String(w.tabCount)]),
      windowId: w.windowId,
    }))
  })
}
