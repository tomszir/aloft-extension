import { browser } from 'wxt/browser'

/**
 * Scale that undoes a site's own zoom inside the overlay frame, which would
 * otherwise inherit it. Measured against the default zoom rather than 100%, so
 * people who raise the default for readability still get a larger Aloft.
 */
export async function zoomCorrection(tabId: number): Promise<number> {
  const [current, settings] = await Promise.all([
    browser.tabs.getZoom(tabId),
    browser.tabs.getZoomSettings(tabId),
  ])
  const base = settings.defaultZoomFactor ?? 1
  return current > 0 ? base / current : 1
}

export function watchZoom(tabId: number, onChange: () => void): () => void {
  const listener = (info: { tabId: number }) => {
    if (info.tabId === tabId) onChange()
  }
  browser.tabs.onZoomChange.addListener(listener)
  return () => browser.tabs.onZoomChange.removeListener(listener)
}
