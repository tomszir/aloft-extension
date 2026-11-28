import { i18n } from '#i18n'
import { type ActionId, otherWindows, type WindowEntry } from '../core/actions'
import type { Result, TabEntry } from '../core/results'
import type { Disposition } from '../platform/open-result'
import type { MenuItem } from '../ui/tile-menu/tile-menu'

type TabResult = Extract<Result, { kind: 'tab' }>

export interface ResultMenuHandlers {
  /** Opens the row as Enter would, or a page in a tab of its choosing. */
  open: (result: Result, disposition?: Disposition) => void
  close: (result: TabResult) => void
  /** Runs a `>` action on the row's tab instead of the one Aloft is over. */
  act: (action: ActionId, tab: TabEntry, windowId?: number) => void
  copy: (url: string) => void
  forget: (url: string) => void
}

/** What the selected row's menu offers; empty for rows that have none. */
export function resultMenu(
  result: Result,
  tabs: readonly TabEntry[],
  windows: readonly WindowEntry[],
  on: ResultMenuHandlers,
): MenuItem[] {
  const copy = (url: string) => ({ label: i18n.t('menuCopyAddress'), run: () => on.copy(url) })
  const pages = (url: string) => [
    { label: i18n.t('menuOpenNewTab'), run: () => on.open(result, 'new-tab') },
    { label: i18n.t('menuOpenHere'), run: () => on.open(result, 'current-tab') },
    copy(url),
  ]
  switch (result.kind) {
    case 'tab': {
      const tab = tabs.find((t) => t.tabId === result.tabId)
      if (!tab) return []
      const act = (action: ActionId, windowId?: number) => () => on.act(action, tab, windowId)
      const own = windows.find((w) => w.windowId === tab.windowId)
      return [
        { label: i18n.t('actionSwitch'), run: () => on.open(result) },
        ...((own?.tabCount ?? 0) > 1
          ? [{ label: i18n.t('actionMoveToNewWindow'), run: act('move-to-new-window') }]
          : []),
        ...otherWindows(windows, tab.windowId).map((w) => ({
          label: i18n.t('actionMoveToWindow', w.tabCount, [w.title, String(w.tabCount)]),
          run: act('move-to-window', w.windowId),
        })),
        tab.pinned
          ? { label: i18n.t('actionUnpin'), run: act('unpin') }
          : { label: i18n.t('actionPin'), run: act('pin') },
        tab.muted
          ? { label: i18n.t('actionUnmute'), run: act('unmute') }
          : { label: i18n.t('actionMute'), run: act('mute') },
        copy(tab.url),
        { label: i18n.t('actionCloseTab'), danger: true, run: () => on.close(result) },
      ]
    }
    case 'history':
      return [
        ...pages(result.url),
        { label: i18n.t('menuRemoveFromHistory'), danger: true, run: () => on.forget(result.url) },
      ]
    case 'bookmark':
      return pages(result.url)
    case 'closed':
      return [{ label: i18n.t('actionRestore'), run: () => on.open(result) }, copy(result.url)]
    default:
      return []
  }
}
