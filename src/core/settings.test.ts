import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, normalizeSettings } from './settings'

describe('normalizeSettings', () => {
  it('returns defaults for empty or non-object input', () => {
    for (const raw of [undefined, null, 42, 'x', [], {}]) {
      expect(normalizeSettings(raw)).toEqual(DEFAULT_SETTINGS)
    }
  })

  it('keeps valid stored values', () => {
    const stored = {
      ...DEFAULT_SETTINGS,
      enterOpensIn: 'current-tab',
      sources: { ...DEFAULT_SETTINGS.sources, history: false },
      appearance: { ...DEFAULT_SETTINGS.appearance, darkTheme: 'moss' },
    }
    expect(normalizeSettings(stored)).toEqual(stored)
  })

  it('fills in fields that an older version did not have', () => {
    const { pinned: _dropped, ...old } = DEFAULT_SETTINGS
    const result = normalizeSettings({ ...old, replaceNewTab: false })
    expect(result.replaceNewTab).toBe(false)
    expect(result.pinned).toEqual(DEFAULT_SETTINGS.pinned)
  })

  it('drops unknown keys', () => {
    const result = normalizeSettings({ ...DEFAULT_SETTINGS, telemetry: true })
    expect(result).not.toHaveProperty('telemetry')
  })

  it('resets only the fields that are invalid', () => {
    const result = normalizeSettings({
      ...DEFAULT_SETTINGS,
      replaceNewTab: false,
      enterOpensIn: 'sideways',
      appearance: { ...DEFAULT_SETTINGS.appearance, darkTheme: '../etc', blur: 'yes' },
    })
    expect(result.replaceNewTab).toBe(false)
    expect(result.enterOpensIn).toBe(DEFAULT_SETTINGS.enterOpensIn)
    expect(result.appearance.darkTheme).toBe(DEFAULT_SETTINGS.appearance.darkTheme)
    expect(result.appearance.blur).toBe(DEFAULT_SETTINGS.appearance.blur)
  })

  it('never returns the shared defaults object', () => {
    const result = normalizeSettings({ enterOpensIn: 'nope' })
    result.sources.history = false
    expect(DEFAULT_SETTINGS.sources.history).toBe(true)
  })
})
