import { fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import type { Release } from '../../core/changelog'
import { BUILT_IN_KEYWORDS } from '../../core/keywords'
import { DEFAULT_SETTINGS, type Settings as SettingsValue } from '../../core/settings'
import type { Shortcuts } from '../../core/shortcut'
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
    />
  ))
  return { settings, onChange, onChangeShortcut, onForgetPicks }
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

    fireEvent.click(screen.getByRole('radio', { name: 'settingsSchemeDark' }))
    expect(settings().appearance.colorScheme).toBe('dark')
    expect(screen.queryByRole('group', { name: 'settingsLightTheme' })).toBeNull()

    fireEvent.click(screen.getByRole('radio', { name: 'Moss' }))
    expect(settings().appearance.darkTheme).toBe('moss')
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
    expect(screen.getByTitle('settingsPreview').getAttribute('src')).toBe(
      'palette.html?host=preview',
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
