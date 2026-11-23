import { createSignal, onCleanup } from 'solid-js'
import { render } from 'solid-js/web'
import { browser } from 'wxt/browser'
import { useSettings } from '../../app/use-settings'
import { useTheme } from '../../app/use-theme'
import { hasSiteAccess, requestSiteAccess, watchSiteAccess } from '../../platform/permissions'
import { type AccessState, Onboarding } from '../../ui/onboarding/onboarding'
import './page.css'

function OnboardingPage() {
  const { settings } = useSettings()
  useTheme(settings)

  const [access, setAccess] = createSignal<AccessState>('unknown')
  const [shortcut, setShortcut] = createSignal('')
  void hasSiteAccess().then((granted) => setAccess(granted ? 'granted' : 'not-asked'))
  onCleanup(watchSiteAccess((granted) => granted && setAccess('granted')))

  // Re-read when the tab regains focus: the user may have just changed the
  // shortcut on the browser's shortcuts page.
  const readShortcut = () =>
    void browser.commands
      .getAll()
      .then((all) => setShortcut(all.find((c) => c.name === 'open-aloft')?.shortcut ?? ''))
  readShortcut()
  window.addEventListener('focus', readShortcut)
  onCleanup(() => window.removeEventListener('focus', readShortcut))

  return (
    <Onboarding
      shortcut={shortcut()}
      access={access()}
      onAllow={() => void requestSiteAccess().then((ok) => setAccess(ok ? 'granted' : 'denied'))}
      onChangeShortcut={() => void browser.tabs.create({ url: 'chrome://extensions/shortcuts' })}
    />
  )
}

const root = document.getElementById('root')
if (root) render(() => <OnboardingPage />, root)
