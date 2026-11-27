import { createResource } from 'solid-js'
import { render } from 'solid-js/web'
import { useCustomThemes } from '../../app/use-custom-themes'
import { useKeywords } from '../../app/use-keywords'
import { useSettings } from '../../app/use-settings'
import { useShortcuts } from '../../app/use-shortcuts'
import { useTheme } from '../../app/use-theme'
import { RELEASES } from '../../core/releases'
import { exportTheme, type Theme } from '../../core/theme'
import { openShortcutSettings } from '../../platform/commands'
import { pageFavicon } from '../../platform/favicon'
import { forgetLearned } from '../../platform/learned'
import { currentVersion, dismissWhatsNew, loadWhatsNew } from '../../platform/whats-new'
import { Settings } from '../../ui/settings/settings'
import './page.css'

// A file saved from the page itself: nothing leaves the computer.
function downloadTheme(theme: Theme): void {
  const url = URL.createObjectURL(new Blob([exportTheme(theme)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `aloft-theme-${theme.id.replace(/^custom-/, '')}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function SettingsPage() {
  const { settings, update } = useSettings()
  const { themes: customThemes, save: saveThemes } = useCustomThemes()
  useTheme(settings, { customThemes })
  const shortcuts = useShortcuts()
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
      shortcuts={shortcuts()}
      onChangeShortcut={openShortcutSettings}
      previewSrc="/palette.html?host=preview"
      keywords={keywords()}
      onKeywordsChange={save}
      favicon={pageFavicon}
      onForgetPicks={forgetLearned}
      version={currentVersion()}
      releases={RELEASES}
      updatedFrom={whatsNew()?.from}
      customThemes={customThemes()}
      onSaveThemes={saveThemes}
      onExportTheme={downloadTheme}
    />
  )
}

const root = document.getElementById('root')
if (root) render(() => <SettingsPage />, root)
