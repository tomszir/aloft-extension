import { browser } from 'wxt/browser'

// The browser's own favicon cache, so showing icons never fetches anything
// from the sites themselves.
export function faviconUrl(pageUrl: string, size = 32): string {
  const url = new URL(`chrome-extension://${browser.runtime.id}/_favicon/`)
  url.searchParams.set('pageUrl', pageUrl)
  url.searchParams.set('size', String(size))
  return url.href
}
