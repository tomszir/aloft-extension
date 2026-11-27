import { browser } from 'wxt/browser'
import { type ActionId, isBrowserPage } from '../core/actions'
import { type ClosedEntry, pageKey } from '../core/results'
import { BROWSER_PAGE_URLS } from './browser-pages'
import type { HostTab } from './open-result'

export interface ActionTarget {
  host: HostTab
  /** Restores this one rather than whatever the browser closed last, which may be an Aloft page. */
  lastClosed: ClosedEntry | undefined
}

// Like typing an address with "switch to open tabs" on: a page already open
// is brought forward rather than opened twice.
async function openBrowserPage(url: string, host: HostTab): Promise<void> {
  const key = pageKey(url)
  const open = (await browser.tabs.query({})).find((t) => t.url && pageKey(t.url) === key)
  if (open?.id !== undefined) {
    await browser.tabs.update(open.id, { active: true })
    await browser.windows.update(open.windowId, { focused: true })
    return
  }
  await browser.tabs.create({ url, windowId: host.windowId, index: host.index + 1 })
}

export async function runAction(action: ActionId, target: ActionTarget): Promise<void> {
  const { host, lastClosed } = target
  if (isBrowserPage(action)) return openBrowserPage(BROWSER_PAGE_URLS[action], host)
  switch (action) {
    case 'pin':
    case 'unpin':
      await browser.tabs.update(host.id, { pinned: action === 'pin' })
      return
    case 'duplicate':
      await browser.tabs.duplicate(host.id)
      return
    case 'new-tab':
      await browser.tabs.create({ windowId: host.windowId, index: host.index + 1 })
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
    case 'open-settings':
      await browser.runtime.openOptionsPage()
      return
  }
}
