// Helium shows helium:// in its UI, but the internal URL may be either, and the
// override page reports its own address while loading.
const NEW_TAB_URLS = ['chrome://newtab/', 'helium://newtab/']

export function isNewTabUrl(url: string | undefined, overrideUrl: string): boolean {
  if (!url) return false
  return NEW_TAB_URLS.includes(url) || url.startsWith(overrideUrl)
}

export interface TabActivity {
  id: number
  lastAccessed: number
}

/** The tab the user was on before pressing Ctrl+T: the last one used other than the new tab. */
export function returnTab(tabs: readonly TabActivity[], newTabId: number): number | undefined {
  let best: TabActivity | undefined
  for (const tab of tabs) {
    if (tab.id !== newTabId && (!best || tab.lastAccessed > best.lastAccessed)) best = tab
  }
  return best?.id
}
