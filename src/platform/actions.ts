import { browser } from 'wxt/browser'
import type { ActionId } from '../core/actions'
import type { ClosedEntry } from '../core/results'
import type { HostTab } from './open-result'

export interface ActionTarget {
  host: HostTab
  /** Restores this one rather than whatever the browser closed last, which may be an Aloft page. */
  lastClosed: ClosedEntry | undefined
}

export async function runAction(action: ActionId, target: ActionTarget): Promise<void> {
  const { host, lastClosed } = target
  switch (action) {
    case 'pin':
    case 'unpin':
      await browser.tabs.update(host.id, { pinned: action === 'pin' })
      return
    case 'duplicate':
      await browser.tabs.duplicate(host.id)
      return
    case 'new-window':
      await browser.windows.create({ focused: true })
      return
    case 'move-to-new-window':
      await browser.windows.create({ tabId: host.id, focused: true })
      return
    case 'close-other-tabs': {
      // Like the browser's own "Close other tabs": pins stay.
      const others = await browser.tabs.query({ windowId: host.windowId, pinned: false })
      const ids = others.flatMap((t) => (t.id === undefined || t.id === host.id ? [] : [t.id]))
      if (ids.length > 0) await browser.tabs.remove(ids)
      return
    }
    case 'reopen-closed-tab':
      if (lastClosed) await browser.sessions.restore(lastClosed.sessionId)
      return
  }
}
