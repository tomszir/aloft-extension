import { render } from 'solid-js/web'
import { useSettings } from '../../app/use-settings'
import { useShortcut } from '../../app/use-shortcut'
import { useSiteAccess } from '../../app/use-site-access'
import { useTheme } from '../../app/use-theme'
import { openShortcutSettings } from '../../platform/commands'
import { Onboarding } from '../../ui/onboarding/onboarding'
import './page.css'

function OnboardingPage() {
  const { settings } = useSettings()
  useTheme(settings)
  const shortcut = useShortcut()
  const { access, request } = useSiteAccess()

  return (
    <Onboarding
      shortcut={shortcut()}
      access={access()}
      onAllow={request}
      onChangeShortcut={openShortcutSettings}
    />
  )
}

const root = document.getElementById('root')
if (root) render(() => <OnboardingPage />, root)
