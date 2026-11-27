import { fireEvent, render, screen, within } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import type { Release } from '../../core/changelog'
import { BUILT_IN_KEYWORDS } from '../../core/keywords'
import { DEFAULT_SETTINGS, type Settings as SettingsValue } from '../../core/settings'
import type { Shortcuts } from '../../core/shortcut'
import { PRESET_THEMES, type Theme } from '../../core/theme'
import { Settings } from './settings'

const release = (version: string): Release => ({
  version,
  date: '1 December 2026',
  intro: [],
  notes: [`Notes for ${version}.`],
})
const RELEASES = ['0.6.0', '0.5.1', '0.5.0', '0.4.0'].map(release)

// The test setup echoes i18n keys, so controls are found by their key.
function renderSettings(
  initial: Partial<SettingsValue> = {},
  shortcuts: Shortcuts = { main: 'Alt+Q', second: '' },
  updatedFrom?: string,
) {
  const [settings, setSettings] = createSignal<SettingsValue>({ ...DEFAULT_SETTINGS, ...initial })
  const onChange = vi.fn((change: (current: SettingsValue) => SettingsValue) =>
    setSettings(change(settings())),
  )
  const onChangeShortcut = vi.fn()
  const [customThemes, setCustomThemes] = createSignal<readonly Theme[]>([])
  const onSaveThemes = vi.fn(async (themes: readonly Theme[]) => {
    setCustomThemes(themes)
    return true
  })
  const onExportTheme = vi.fn()
  const onForgetPicks = vi.fn(async () => {})
  render(() => (
    <Settings
      settings={settings()}
      onChange={onChange}
      shortcuts={shortcuts}
      onChangeShortcut={onChangeShortcut}
      previewSrc="palette.html?host=preview"
      keywords={BUILT_IN_KEYWORDS}
      onKeywordsChange={async () => true}
      favicon={async () => null}
      onForgetPicks={onForgetPicks}
      version="0.6.0"
      releases={RELEASES}
      updatedFrom={updatedFrom}
      customThemes={customThemes()}
      onSaveThemes={onSaveThemes}
      onExportTheme={onExportTheme}
    />
  ))
  return {
    settings,
    onChange,
    onChangeShortcut,
    onForgetPicks,
    customThemes,
    onSaveThemes,
    onExportTheme,
  }
}

describe('Settings', () => {
  describe("what's new", () => {
    const section = () => screen.getByRole('region', { name: 'settingsWhatsNew' })
    const visibleVersions = () =>
      [...section().querySelectorAll('h3')]
        .filter((h) => !h.closest('details'))
        .map((h) => h.id.replace('al-release-', ''))

    it('shows the latest release, with older ones behind a disclosure', () => {
      renderSettings()
      expect(visibleVersions()).toEqual(['0.6.0'])
      expect(section().querySelectorAll('details h3')).toHaveLength(3)
      expect(screen.queryByText('settingsUpdated')).toBeNull()
    })

    it('after an update, says so and shows everything since the version you had', () => {
      renderSettings({}, undefined, '0.5.0')
      expect(screen.getByText('settingsUpdated', { exact: false })).toBeTruthy()
      expect(screen.getByRole('link', { name: 'settingsSeeWhatsNew' }).getAttribute('href')).toBe(
        '#whats-new',
      )
      expect(visibleVersions()).toEqual(['0.6.0', '0.5.1'])
      expect(section().id).toBe('whats-new')
    })

    it('can stop Aloft mentioning updates', () => {
      const { settings } = renderSettings()
      fireEvent.click(screen.getByRole('switch', { name: 'settingsWhatsNewInAloft' }))
      expect(settings().whatsNewInAloft).toBe(false)
    })
  })

  it('turns a source off without touching the others', () => {
    const { settings } = renderSettings()
    fireEvent.click(screen.getByRole('switch', { name: 'sectionHistory' }))
    expect(settings().sources).toEqual({ ...DEFAULT_SETTINGS.sources, history: false })
  })

  it('changes what Enter does', () => {
    const { settings } = renderSettings()
    fireEvent.click(screen.getByRole('radio', { name: 'settingsEnterCurrentTab' }))
    expect(settings().enterOpensIn).toBe('current-tab')
  })

  it('shows only the theme list that the color scheme uses', () => {
    const { settings } = renderSettings()
    expect(screen.getByRole('group', { name: 'settingsLightTheme' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'settingsDarkTheme' })).toBeTruthy()

    const scheme = screen.getByRole('group', { name: 'settingsColorScheme' })
    fireEvent.click(within(scheme).getByRole('radio', { name: 'settingsSchemeDark' }))
    expect(settings().appearance.colorScheme).toBe('dark')
    expect(screen.queryByRole('group', { name: 'settingsLightTheme' })).toBeNull()

    fireEvent.click(screen.getByRole('radio', { name: 'Moss' }))
    expect(settings().appearance.darkTheme).toBe('moss')
  })

  describe('custom themes', () => {
    const editor = () => screen.getByRole('form', { name: 'themeEditorLabel' })
    const previewSrc = () => screen.getByTitle('settingsPreview').getAttribute('src') ?? ''

    it('customizes a copy of the theme in use, shows it in the preview, and saves it', async () => {
      const { settings, onSaveThemes } = renderSettings({
        appearance: { ...DEFAULT_SETTINGS.appearance, colorScheme: 'dark' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'themeCustomize' }))
      expect(editor()).toBeTruthy()
      expect(previewSrc()).toContain('scheme=dark&theme=')

      fireEvent.click(within(editor()).getByRole('button', { name: 'themeSave' }))
      await vi.waitFor(() => expect(onSaveThemes).toHaveBeenCalled())
      const saved = onSaveThemes.mock.calls[0]?.[0]?.[0]
      expect(saved?.id).toMatch(/^custom-/)
      await vi.waitFor(() => expect(settings().appearance.darkTheme).toBe(saved?.id))
      expect(screen.queryByRole('form')).toBeNull()
      expect(previewSrc()).not.toContain('theme=')
    })

    it('edits a saved theme in place, and deleting it goes back to the built-in one', async () => {
      const { settings, onSaveThemes, customThemes } = renderSettings({
        appearance: { ...DEFAULT_SETTINGS.appearance, colorScheme: 'dark' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'themeCustomize' }))
      fireEvent.click(within(editor()).getByRole('button', { name: 'themeSave' }))
      await vi.waitFor(() => expect(customThemes()).toHaveLength(1))

      fireEvent.click(screen.getByRole('button', { name: 'themeEdit' }))
      fireEvent.click(within(editor()).getByRole('button', { name: 'themeDelete' }))
      await vi.waitFor(() => expect(customThemes()).toHaveLength(0))
      expect(onSaveThemes).toHaveBeenCalledTimes(2)
      expect(settings().appearance.darkTheme).toBe('helium-dark')
    })

    it('opens an imported theme in the editor, and explains a file it cannot use', async () => {
      renderSettings()
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = (text: string) => new File([text], 'theme.json', { type: 'application/json' })
      const exported = JSON.stringify({
        format: 'aloft-theme',
        version: 1,
        theme: { name: 'Shared', scheme: 'light', radius: 8, colors: PRESET_THEMES[1]?.colors },
      })
      fireEvent.change(input, { target: { files: [file(exported)] } })
      await vi.waitFor(() => expect(editor()).toBeTruthy())
      expect(
        (within(editor()).getByRole('textbox', { name: 'themeName' }) as HTMLInputElement).value,
      ).toBe('Shared')

      fireEvent.click(within(editor()).getByRole('button', { name: 'themeCancel' }))
      fireEvent.change(input, { target: { files: [file('not json')] } })
      await vi.waitFor(() =>
        expect(screen.getByRole('alert').textContent).toBe('themeImportNotJson'),
      )
    })
  })

  it('picks a font installed on the computer by name, and a density', () => {
    const { settings } = renderSettings()
    const font = screen.getByRole('group', { name: 'settingsFont' })
    fireEvent.click(within(font).getByRole('radio', { name: 'settingsFontCustom' }))
    const name = screen.getByRole('textbox', { name: 'settingsFontName' })
    fireEvent.change(name, { target: { value: ' Atkinson Hyperlegible ' } })
    expect(settings().appearance.customFont).toBe('Atkinson Hyperlegible')
    const density = screen.getByRole('group', { name: 'settingsDensity' })
    fireEvent.click(within(density).getByRole('radio', { name: 'settingsDensityCompact' }))
    expect(settings().appearance.density).toBe('compact')
  })

  it("offers to set Ctrl+T on the browser's shortcuts page until it's set", () => {
    const { onChangeShortcut } = renderSettings()
    fireEvent.click(screen.getByRole('button', { name: 'ctrlTButton' }))
    expect(onChangeShortcut).toHaveBeenCalled()
  })

  it('says Ctrl+T opens Aloft once it does', () => {
    renderSettings({}, { main: 'Alt+Q', second: 'Ctrl+T' })
    expect(screen.getByText('ctrlTDone')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'ctrlTButton' })).toBeNull()
  })

  it('shows the palette as a preview', () => {
    renderSettings()
    expect(screen.getByTitle('settingsPreview').getAttribute('src')).toMatch(
      /^palette\.html\?host=preview#/,
    )
  })

  it('turns learning off, and forgets what was learned on request', async () => {
    const { settings, onForgetPicks } = renderSettings()
    fireEvent.click(screen.getByRole('switch', { name: 'settingsLearnFromPicks' }))
    expect(settings().learnFromPicks).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'settingsForgetPicks' }))
    expect(onForgetPicks).toHaveBeenCalledOnce()
    expect(await screen.findByText('settingsPicksForgotten')).toBeTruthy()
  })
})
