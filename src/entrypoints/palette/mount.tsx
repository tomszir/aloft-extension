import { render } from 'solid-js/web'
import { currentTab } from '../../platform/palette-api'
import { App, type Host } from './app'
import './page.css'

export function mountPalette(host: Host): void {
  document.documentElement.dataset.host = host

  // Asked for up front so opening and closing don't wait on a round trip.
  const hostTab = currentTab()

  const root = document.getElementById('root')
  if (root) render(() => <App host={host} hostTab={hostTab} />, root)
}
