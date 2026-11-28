import { browser } from 'wxt/browser'
import { pageKey, type Result, type TabEntry } from '../core/results'
import { navigableUrl } from '../core/url'

export type Disposition = 'new-tab' | 'current-tab'

export interface HostTab {
  id: number
  index: number
  windowId: number
  /** The tab Aloft's own tab was opened beside, to go back to. */
  openerTabId?: number | undefined
}

export interface OpenContext {
  host: HostTab
  /** Open tabs, for switching instead of opening the same page twice. */
  openTabs: readonly TabEntry[]
  switchToOpenTabs: boolean
}

async function focusTab(tabId: number, windowId: number): Promise<void> {
  await browser.tabs.update(tabId, { active: true })
  await browser.windows.update(windowId, { focused: true })
}

/** True when the host tab loads another page, which replaces the palette with it. */
async function openUrl(
  address: string,
  disposition: Disposition,
  context: OpenContext,
): Promise<boolean> {
  const { host, openTabs, switchToOpenTabs } = context
  const url = navigableUrl(address)
  const key = pageKey(url)
  if (switchToOpenTabs) {
    const open = openTabs.find((t) => t.tabId !== host.id && pageKey(t.url) === key)
    if (open) {
      await focusTab(open.tabId, open.windowId)
      return false
    }
  }
  if (disposition === 'current-tab') {
    await browser.tabs.update(host.id, { url })
    // Only the fragment changes on the same page, which doesn't load anything.
    const hostUrl = openTabs.find((t) => t.tabId === host.id)?.url
    return hostUrl === undefined || pageKey(hostUrl) !== key
  }
  await browser.tabs.create({ url, windowId: host.windowId, index: host.index + 1 })
  return false
}

/**
 * Opens a result. True when it loaded a page in the host tab, which replaces
 * the palette; otherwise the palette is still there and has to close itself.
 */
export async function openResult(
  result: Result,
  disposition: Disposition,
  context: OpenContext,
): Promise<boolean> {
  switch (result.kind) {
    case 'search':
      await browser.search.query({
        text: result.query,
        ...(disposition === 'current-tab'
          ? { tabId: context.host.id }
          : { disposition: 'NEW_TAB' as const }),
      })
      return disposition === 'current-tab'
    case 'tab':
      await focusTab(result.tabId, result.windowId)
      return false
    case 'closed':
      await browser.sessions.restore(result.sessionId)
      return false
    case 'url':
    case 'site':
    case 'history':
    case 'bookmark':
      return openUrl(result.url, disposition, context)
    case 'keyword':
      // Offers a chip; the palette enters it instead of opening anything.
      return false
  }
  return false
}
