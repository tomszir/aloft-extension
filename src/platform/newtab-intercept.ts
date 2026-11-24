import { type Browser, browser } from 'wxt/browser'
import { isNewTabUrl, returnTab } from '../core/newtab'
import { injectOverlay } from './overlay'
import { hasSiteAccess } from './permissions'
import { loadSettings } from './settings'

// Tabs already looked at, so a tab reported by both onCreated and onUpdated
// isn't handled twice, which would draw the overlay twice.
const seen = new Set<number>()

async function interceptNewTab(tab: Browser.tabs.Tab): Promise<void> {
  // Background tabs (middle-clicking +) were opened on purpose; leave them.
  if (tab.id === undefined || !tab.active || seen.has(tab.id)) return
  if (!isNewTabUrl(tab.pendingUrl ?? tab.url, browser.runtime.getURL('/newtab.html'))) return
  seen.add(tab.id)

  const [settings, access] = await Promise.all([loadSettings(), hasSiteAccess()])
  if (!settings.replaceNewTab || !access) return

  const siblings = await browser.tabs.query({ windowId: tab.windowId })
  const previousId = returnTab(
    siblings.flatMap((t) =>
      t.id === undefined ? [] : [{ id: t.id, lastAccessed: t.lastAccessed ?? 0 }],
    ),
    tab.id,
  )
  if (previousId === undefined) return

  // Injected while the new tab is still showing, so a page that refuses it
  // (browser pages, the Web Store) just leaves the new tab, which shows the
  // palette itself, with no flicker.
  if (!(await injectOverlay(previousId))) return
  // Switch back before closing, or Chrome would activate whichever tab sits
  // next to the new one.
  await browser.tabs.update(previousId, { active: true })
  await browser.tabs.remove(tab.id)
}

export function watchNewTabs(): void {
  browser.tabs.onCreated.addListener((tab) => {
    void interceptNewTab(tab)
  })
  // Firefox creates the tab as about:blank, with no pendingUrl, and reports
  // the new tab page's address only in a later update.
  browser.tabs.onUpdated.addListener((_tabId, change, tab) => {
    if (change.url) void interceptNewTab(tab)
  })
  browser.tabs.onRemoved.addListener((tabId) => {
    seen.delete(tabId)
  })
}
