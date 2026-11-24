import { browser } from 'wxt/browser'
import { pageKey, type Result, type TabEntry } from '../core/results'

export type Disposition = 'new-tab' | 'current-tab'

export interface HostTab {
  id: number
  index: number
  windowId: number
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

async function openUrl(url: string, disposition: Disposition, context: OpenContext) {
  const { host, openTabs, switchToOpenTabs } = context
  if (switchToOpenTabs) {
    const key = pageKey(url)
    const open = openTabs.find((t) => t.tabId !== host.id && pageKey(t.url) === key)
    if (open) return focusTab(open.tabId, open.windowId)
  }
  if (disposition === 'current-tab') {
    await browser.tabs.update(host.id, { url })
    return
  }
  await browser.tabs.create({ url, windowId: host.windowId, index: host.index + 1 })
}

export async function openResult(
  result: Result,
  disposition: Disposition,
  context: OpenContext,
): Promise<void> {
  switch (result.kind) {
    case 'search':
      await browser.search.query({
        text: result.query,
        ...(disposition === 'current-tab'
          ? { tabId: context.host.id }
          : { disposition: 'NEW_TAB' as const }),
      })
      return
    case 'tab':
      await focusTab(result.tabId, result.windowId)
      return
    case 'closed':
      await browser.sessions.restore(result.sessionId)
      return
    case 'url':
    case 'site':
    case 'history':
    case 'bookmark':
      await openUrl(result.url, disposition, context)
      return
    case 'keyword':
      // Offers a chip; the palette enters it instead of opening anything.
      return
  }
}
