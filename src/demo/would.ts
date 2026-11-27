import { actionEntries } from '../app/action-entries'
import type { ActionId } from '../core/actions'
import { displayUrl } from '../core/results'
import { t } from './i18n'

export type Where = 'new-tab' | 'current-tab'

/** "Would open …": what the extension would have done, since the demo can't leave the page. */
export const would = {
  switchTo: (title: string) => t('wouldSwitch', [title]),
  open: (page: { title?: string; url: string }, where: Where) =>
    t(where === 'new-tab' ? 'wouldOpenNewTab' : 'wouldOpenHere', [
      page.title || displayUrl(page.url),
    ]),
  search: (query: string) => t('wouldSearch', [query]),
  reopen: (title: string) => t('wouldReopen', [title]),
  run: (action: ActionId) => t('wouldRun', [actionEntries([action])[0]?.label ?? action]),
}
