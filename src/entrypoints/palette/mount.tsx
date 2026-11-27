import { render } from 'solid-js/web'
import { DEFAULT_SETTINGS } from '../../core/settings'
import { currentTab } from '../../platform/palette-api'
import { loadSettings } from '../../platform/settings'
import { loadCustomThemes } from '../../platform/themes'
import { App, type Host } from './app'
import './page.css'

export async function mountPalette(host: Host): Promise<void> {
  document.documentElement.dataset.host = host

  // Asked for up front so opening and closing don't wait on a round trip.
  const hostTab = currentTab()
  // Drawn only once the settings are in: with the defaults first, a palette
  // with another theme or scheme would flash the default one (often white).
  const [settings, customThemes] = await Promise.all([
    loadSettings().catch(() => DEFAULT_SETTINGS),
    loadCustomThemes().catch(() => []),
  ])

  const root = document.getElementById('root')
  if (root)
    render(
      () => <App host={host} hostTab={hostTab} settings={settings} customThemes={customThemes} />,
      root,
    )
}
