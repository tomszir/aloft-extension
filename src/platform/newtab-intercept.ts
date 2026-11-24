import { type Browser, browser } from 'wxt/browser'
import { isNewTabUrl, returnTab } from '../core/newtab'
import { isNewTabStaysMessage } from './messages'
import { drawOverlay, prepareOverlay } from './overlay'
import { hasSiteAccess } from './permissions'
import { loadSettings } from './settings'

// Whether each new tab looked at was replaced by the overlay. A tab reported by
// both onCreated and onUpdated is handled once, or the overlay would be drawn
// twice, and its page can wait on the answer before drawing anything.
const replaced = new Map<number, Promise<boolean>>()

function interceptNewTab(tab: Browser.tabs.Tab): void {
  // Background tabs (middle-clicking +) were opened on purpose; leave them.
  if (tab.id === undefined || !tab.active || replaced.has(tab.id)) return
  if (!isNewTabUrl(tab.pendingUrl ?? tab.url, browser.runtime.getURL('/newtab.html'))) return
  replaced.set(
    tab.id,
    replaceNewTab(tab.id, tab.windowId).catch(() => false),
  )
}

// Until the browser is back on the previous tab, keys go to the new tab's
// address bar and are lost, so nothing waits that doesn't have to.
async function replaceNewTab(newTabId: number, windowId: number): Promise<boolean> {
  const [settings, access, siblings] = await Promise.all([
    loadSettings(),
    hasSiteAccess(),
    browser.tabs.query({ windowId }),
  ])
  if (!settings.replaceNewTab || !access) return false

  const previousId = returnTab(
    siblings.flatMap((t) =>
      t.id === undefined ? [] : [{ id: t.id, lastAccessed: t.lastAccessed ?? 0 }],
    ),
    newTabId,
  )
  if (previousId === undefined) return false

  // Checked while the new tab is still showing, so a page that refuses scripts
  // (browser pages, the Web Store) just leaves the new tab, which shows the
  // palette itself, with no flicker.
  if (!(await prepareOverlay(previousId, settings))) return false
  // Switch back before closing, or Chrome would activate whichever tab sits
  // next to the new one.
  const [drawn] = await Promise.all([
    drawOverlay(previousId),
    browser.tabs.update(previousId, { active: true }),
  ])
  if (!drawn) {
    // The page went away between the two scripts; the new tab is still there.
    await browser.tabs.update(newTabId, { active: true })
    return false
  }
  await browser.tabs.remove(newTabId)
  return true
}

export function watchNewTabs(): void {
  browser.tabs.onCreated.addListener(interceptNewTab)
  // Firefox creates the tab as about:blank, with no pendingUrl, and reports
  // the new tab page's address only in a later update.
  browser.tabs.onUpdated.addListener((_tabId, change, tab) => {
    if (change.url) interceptNewTab(tab)
  })
  browser.tabs.onRemoved.addListener((tabId) => {
    replaced.delete(tabId)
  })
  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    if (!isNewTabStaysMessage(message) || sender.id !== browser.runtime.id) return
    // Answered once decided; a replaced tab is gone by then. No decision means
    // the tab wasn't opened as a new tab just now (a reload, or the background
    // restarted since), so it stays.
    const decision = sender.tab?.id === undefined ? undefined : replaced.get(sender.tab.id)
    void (decision ?? Promise.resolve(false)).then(() => sendResponse(true))
    return true
  })
}
