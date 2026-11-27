import { render } from 'solid-js/web'
import { useSettings } from '../../app/use-settings'
import { useShortcuts } from '../../app/use-shortcuts'
import { useTheme } from '../../app/use-theme'
import { openShortcutSettings } from '../../platform/commands'
import { Onboarding } from '../../ui/onboarding/onboarding'
import './page.css'

function OnboardingPage() {
  const { settings } = useSettings()
  useTheme(settings)
  const shortcuts = useShortcuts()

  return (
    <Onboarding
      shortcuts={shortcuts()}
      onChangeShortcut={openShortcutSettings}
      ctrlTMoved={location.hash === '#ctrl-t'}
    />
  )
}

const root = document.getElementById('root')
if (root) render(() => <OnboardingPage />, root)
