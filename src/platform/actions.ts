import { browser } from 'wxt/browser'
import { type ActionId, duplicateTabs, isBrowserPage } from '../core/actions'
import { type ClosedEntry, pageKey } from '../core/results'
import { BROWSER_PAGE_URLS } from './browser-pages'
import type { HostTab } from './open-result'
import { loadTabs } from './sources'

export interface ActionTarget {
  host: HostTab
  /** Restores this one rather than whatever the browser closed last, which may be an Aloft page. */
  lastClosed: ClosedEntry | undefined
  /** Where "Move tab to window" moves it. */
  windowId?: number
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

async function bookmarksOf(tabId: number) {
  const { url } = await browser.tabs.get(tabId)
  return url ? await browser.bookmarks.search({ url }) : []
}

/**
 * Runs an action on the tab the palette is over. True when that tab closed or
 * reloaded, which takes the palette with it; otherwise it has to close itself.
 */
export async function runAction(action: ActionId, target: ActionTarget): Promise<boolean> {
  const { host, lastClosed } = target
  if (isBrowserPage(action)) {
    await openBrowserPage(BROWSER_PAGE_URLS[action], host)
    return false
  }
  switch (action) {
    case 'close-tab':
      await browser.tabs.remove(host.id)
      return true
    case 'reload':
      await browser.tabs.reload(host.id)
      return true
    case 'mute':
    case 'unmute':
      await browser.tabs.update(host.id, { muted: action === 'mute' })
      break
    case 'bookmark': {
      // Where the browser puts bookmarks made without a folder: Other
      // Bookmarks in Chromium and Firefox alike.
      const { title, url } = await browser.tabs.get(host.id)
      if (url) await browser.bookmarks.create({ title: title || url, url })
      break
    }
    case 'remove-bookmark':
      for (const b of await bookmarksOf(host.id)) await browser.bookmarks.remove(b.id)
      break
    case 'close-duplicate-tabs': {
      const ids = duplicateTabs(await loadTabs(), host)
      if (ids.length > 0) await browser.tabs.remove(ids)
      break
    }
    case 'move-to-window': {
      const { windowId } = target
      if (windowId === undefined) break
      // As the browser's own "Move tab to another window", the tab goes along.
      await browser.tabs.move(host.id, { windowId, index: -1 })
      await browser.tabs.update(host.id, { active: true })
      await browser.windows.update(windowId, { focused: true })
      break
    }
    case 'pin':
    case 'unpin':
      await browser.tabs.update(host.id, { pinned: action === 'pin' })
      break
    case 'duplicate':
      await browser.tabs.duplicate(host.id)
      break
    case 'new-tab':
      await browser.tabs.create({ windowId: host.windowId, index: host.index + 1 })
      break
    case 'new-window':
      await browser.windows.create({ focused: true })
      break
    case 'move-to-new-window':
      await browser.windows.create({ tabId: host.id, focused: true })
      break
    case 'close-other-tabs': {
      // Like the browser's own "Close other tabs": pins stay.
      const others = await browser.tabs.query({ windowId: host.windowId, pinned: false })
      const ids = others.flatMap((t) => (t.id === undefined || t.id === host.id ? [] : [t.id]))
      if (ids.length > 0) await browser.tabs.remove(ids)
      break
    }
    case 'reopen-closed-tab':
      if (lastClosed) await browser.sessions.restore(lastClosed.sessionId)
      break
    case 'open-settings':
      await browser.runtime.openOptionsPage()
      break
  }
  return false
}
