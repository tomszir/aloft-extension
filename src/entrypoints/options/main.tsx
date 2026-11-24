import { render } from 'solid-js/web'
import { useSettings } from '../../app/use-settings'
import { useShortcut } from '../../app/use-shortcut'
import { useSiteAccess } from '../../app/use-site-access'
import { useTheme } from '../../app/use-theme'
import { openShortcutSettings } from '../../platform/commands'
import { Settings } from '../../ui/settings/settings'
import './page.css'

function SettingsPage() {
  const { settings, update } = useSettings()
  useTheme(settings)
  const shortcut = useShortcut()
  const { access, request } = useSiteAccess()

  return (
    <Settings
      settings={settings()}
      onChange={(change) => void update(change)}
      shortcut={shortcut()}
      onChangeShortcut={openShortcutSettings}
      access={access()}
      onAllow={request}
      previewSrc="/palette.html?host=preview"
    />
  )
}

const root = document.getElementById('root')
if (root) render(() => <SettingsPage />, root)
