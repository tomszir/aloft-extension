import { render } from 'solid-js/web'
import { browser } from 'wxt/browser'
import type { HostTab } from '../../platform/open-result'
import { App, type Host } from './app'
import './page.css'

export function mountPalette(host: Host): void {
  document.documentElement.dataset.host = host

  // Asked for up front so opening and closing don't wait on a round trip.
  const hostTab = browser.tabs
    .getCurrent()
    .then((tab): HostTab | undefined =>
      tab?.id === undefined ? undefined : { id: tab.id, index: tab.index, windowId: tab.windowId },
    )

  const root = document.getElementById('root')
  if (root) render(() => <App host={host} hostTab={hostTab} />, root)
}
