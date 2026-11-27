import type { BrowserPageId } from '../core/actions'

/**
 * Firefox refuses its own pages (about:preferences, about:addons and the
 * rest) from an extension, so those actions are left out there.
 */
export const HAS_BROWSER_PAGES = !import.meta.env.FIREFOX

// chrome:// works in every Chromium browser, including those that show these
// pages under their own scheme (helium://, brave://, edge://).
export const BROWSER_PAGE_URLS: Record<BrowserPageId, string> = {
  history: 'chrome://history/',
  downloads: 'chrome://downloads/',
  bookmarks: 'chrome://bookmarks/',
  // chrome://settings/passwords now lands on the settings page itself.
  passwords: 'chrome://password-manager/passwords',
  extensions: 'chrome://extensions/',
  'extension-shortcuts': 'chrome://extensions/shortcuts',
  'browser-settings': 'chrome://settings/',
  'clear-browsing-data': 'chrome://settings/clearBrowserData',
}
