import { fireEvent, render, screen } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type Settings } from '../../core/settings'
import { SettingsPreview } from './settings-preview'

const appearance = (patch: Partial<Settings['appearance']> = {}) => ({
  ...DEFAULT_SETTINGS.appearance,
  ...patch,
})
const frame = () => screen.getByTitle('settingsPreview') as HTMLIFrameElement

// The test setup echoes i18n keys, so controls are found by their key.
describe('SettingsPreview', () => {
  it('shows the palette like the overlay does: transparent, blurred behind', () => {
    render(() => <SettingsPreview src="palette.html?host=preview" appearance={appearance()} />)
    expect(frame().getAttribute('src')).toMatch(/^palette\.html\?host=preview#scheme=(light|dark)$/)
    expect(frame().style.colorScheme).toBe('light dark')
    expect(frame().style.backdropFilter).toBe('blur(4px)')
  })

  it('switches between the light and dark theme when they follow the system', () => {
    render(() => <SettingsPreview src="p.html" appearance={appearance()} />)
    fireEvent.click(screen.getByRole('radio', { name: 'settingsSchemeDark' }))
    expect(frame().getAttribute('src')).toBe('p.html#scheme=dark')
    fireEvent.click(screen.getByRole('radio', { name: 'settingsSchemeLight' }))
    expect(frame().getAttribute('src')).toBe('p.html#scheme=light')
  })

  it('shows the one scheme in use, without the switch, when one is chosen', () => {
    render(() => (
      <SettingsPreview src="p.html" appearance={appearance({ colorScheme: 'dark', blur: false })} />
    ))
    expect(screen.queryByRole('radio')).toBeNull()
    expect(frame().getAttribute('src')).toBe('p.html#scheme=dark')
    expect(frame().style.backdropFilter).toBe('none')
  })
})
