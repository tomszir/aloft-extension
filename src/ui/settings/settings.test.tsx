import { fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { BUILT_IN_KEYWORDS } from '../../core/keywords'
import { DEFAULT_SETTINGS, type Settings as SettingsValue } from '../../core/settings'
import type { AccessState } from '../onboarding/onboarding'
import { Settings } from './settings'

// The test setup echoes i18n keys, so controls are found by their key.
function renderSettings(initial: Partial<SettingsValue> = {}, access: AccessState = 'granted') {
  const [settings, setSettings] = createSignal<SettingsValue>({ ...DEFAULT_SETTINGS, ...initial })
  const onChange = vi.fn((change: (current: SettingsValue) => SettingsValue) =>
    setSettings(change(settings())),
  )
  const onAllow = vi.fn()
  const onForgetPicks = vi.fn(async () => {})
  render(() => (
    <Settings
      settings={settings()}
      onChange={onChange}
      shortcut="Alt+Q"
      onChangeShortcut={vi.fn()}
      access={access}
      onAllow={onAllow}
      previewSrc="palette.html?host=preview"
      keywords={BUILT_IN_KEYWORDS}
      onKeywordsChange={async () => true}
      favicon={async () => null}
      onForgetPicks={onForgetPicks}
    />
  ))
  return { settings, onChange, onAllow, onForgetPicks }
}

describe('Settings', () => {
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

  it('asks for site access when Ctrl+T is on without it', () => {
    const { onAllow } = renderSettings({}, 'not-asked')
    fireEvent.click(screen.getByRole('button', { name: 'onboardingAllow' }))
    expect(onAllow).toHaveBeenCalled()
  })

  it('does not ask for access once Ctrl+T is off', () => {
    renderSettings({ replaceNewTab: false }, 'not-asked')
    expect(screen.queryByRole('button', { name: 'onboardingAllow' })).toBeNull()
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
