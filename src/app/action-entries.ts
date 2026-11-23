import { i18n } from '#i18n'
import type { ActionEntry, ActionId } from '../core/actions'

// Keywords stay English on purpose: they're extra ways in, on top of the
// translated label, which is always matched too.
const KEYWORDS: Record<ActionId, string> = {
  pin: 'pin essential keep',
  unpin: 'unpin remove',
  duplicate: 'copy clone',
  'new-window': 'window open',
  'move-to-new-window': 'window detach split',
  'close-other-tabs': 'close tabs others clean',
  'reopen-closed-tab': 'restore undo closed',
}

const LABEL: Record<ActionId, () => string> = {
  pin: () => i18n.t('actionPin'),
  unpin: () => i18n.t('actionUnpin'),
  duplicate: () => i18n.t('actionDuplicate'),
  'new-window': () => i18n.t('actionNewWindow'),
  'move-to-new-window': () => i18n.t('actionMoveToNewWindow'),
  'close-other-tabs': () => i18n.t('actionCloseOtherTabs'),
  'reopen-closed-tab': () => i18n.t('actionReopenClosedTab'),
}

// The OS, not the browser, decides how shortcuts are written.
const isMac = /mac/i.test(navigator.platform)

const HINT: Partial<Record<ActionId, string>> = isMac
  ? { 'new-window': '⌘N', 'reopen-closed-tab': '⇧⌘T' }
  : { 'new-window': 'Ctrl+N', 'reopen-closed-tab': 'Ctrl+Shift+T' }

export function actionEntries(ids: readonly ActionId[]): ActionEntry[] {
  return ids.map((id) => ({ id, label: LABEL[id](), keywords: KEYWORDS[id], hint: HINT[id] ?? '' }))
}
