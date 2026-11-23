import { browser } from 'wxt/browser'

// Ctrl+T and Ctrl+L aren't gestures Chrome grants activeTab for, so drawing
// over the page there needs access to all sites.
const SITE_ACCESS = { origins: ['<all_urls>'] }

export function hasSiteAccess(): Promise<boolean> {
  return browser.permissions.contains(SITE_ACCESS)
}

/** Must be called from a click: Chrome only shows the prompt for a user gesture. */
export function requestSiteAccess(): Promise<boolean> {
  return browser.permissions.request(SITE_ACCESS)
}

export function watchSiteAccess(onChange: (granted: boolean) => void): () => void {
  const update = () => void hasSiteAccess().then(onChange)
  browser.permissions.onAdded.addListener(update)
  browser.permissions.onRemoved.addListener(update)
  return () => {
    browser.permissions.onAdded.removeListener(update)
    browser.permissions.onRemoved.removeListener(update)
  }
}
