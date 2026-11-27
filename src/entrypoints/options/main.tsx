import { createResource } from 'solid-js'
import { render } from 'solid-js/web'
import { useKeywords } from '../../app/use-keywords'
import { useSettings } from '../../app/use-settings'
import { useShortcut } from '../../app/use-shortcut'
import { useSiteAccess } from '../../app/use-site-access'
import { useTheme } from '../../app/use-theme'
import { RELEASES } from '../../core/releases'
import { openShortcutSettings } from '../../platform/commands'
import { pageFavicon } from '../../platform/favicon'
import { forgetLearned } from '../../platform/learned'
import { currentVersion, dismissWhatsNew, loadWhatsNew } from '../../platform/whats-new'
import { Settings } from '../../ui/settings/settings'
import './page.css'

function SettingsPage() {
  const { settings, update } = useSettings()
  useTheme(settings)
  const shortcut = useShortcut()
  const { access, request } = useSiteAccess()
  const { keywords, save } = useKeywords()
  // Showing what's new here is what makes it old news: the palette stops
  // offering it.
  const [whatsNew] = createResource(async () => {
    const pending = await loadWhatsNew(Date.now())
    if (pending) await dismissWhatsNew()
    // The note above the settings moves the section down once it appears.
    if (location.hash === '#whats-new')
      requestAnimationFrame(() => document.getElementById('whats-new')?.scrollIntoView())
    return pending
  })

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
      version={currentVersion()}
      releases={RELEASES}
      updatedFrom={whatsNew()?.from}
    />
  )
}

const root = document.getElementById('root')
if (root) render(() => <SettingsPage />, root)
