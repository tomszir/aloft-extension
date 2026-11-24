import { render } from 'solid-js/web'
import { useKeywords } from '../../app/use-keywords'
import { useSettings } from '../../app/use-settings'
import { useShortcut } from '../../app/use-shortcut'
import { useSiteAccess } from '../../app/use-site-access'
import { useTheme } from '../../app/use-theme'
import { openShortcutSettings } from '../../platform/commands'
import { pageFavicon } from '../../platform/favicon'
import { forgetLearned } from '../../platform/learned'
import { Settings } from '../../ui/settings/settings'
import './page.css'

function SettingsPage() {
  const { settings, update } = useSettings()
  useTheme(settings)
  const shortcut = useShortcut()
  const { access, request } = useSiteAccess()
  const { keywords, save } = useKeywords()

  return (
    <Settings
      settings={settings()}
      onChange={(change) => void update(change)}
      shortcut={shortcut()}
      onChangeShortcut={openShortcutSettings}
      access={access()}
      onAllow={request}
      previewSrc="/palette.html?host=preview"
      keywords={keywords()}
      onKeywordsChange={save}
      favicon={pageFavicon}
      onForgetPicks={forgetLearned}
    />
  )
}

const root = document.getElementById('root')
if (root) render(() => <SettingsPage />, root)
