import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, keepUnknown, normalizeSettings } from './settings'

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
    const result = normalizeSettings({ ...old, learnFromPicks: false })
    expect(result.learnFromPicks).toBe(false)
    expect(result.pinned).toEqual(DEFAULT_SETTINGS.pinned)
  })

  it('drops unknown keys', () => {
    const result = normalizeSettings({ ...DEFAULT_SETTINGS, telemetry: true })
    expect(result).not.toHaveProperty('telemetry')
  })

  it('drops settings older versions had, like replacing the new tab page', () => {
    const result = normalizeSettings({ ...DEFAULT_SETTINGS, replaceNewTab: true })
    expect(result).not.toHaveProperty('replaceNewTab')
  })

  it('resets only the fields that are invalid', () => {
    const result = normalizeSettings({
      ...DEFAULT_SETTINGS,
      learnFromPicks: false,
      enterOpensIn: 'sideways',
      appearance: { ...DEFAULT_SETTINGS.appearance, darkTheme: '../etc', blur: 'yes' },
    })
    expect(result.learnFromPicks).toBe(false)
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

describe('keepUnknown', () => {
  it("writes the settings over what's stored, keeping keys from newer versions at every level", () => {
    const stored = {
      ...DEFAULT_SETTINGS,
      fromTheFuture: 1,
      appearance: { ...DEFAULT_SETTINGS.appearance, sparkles: true },
    }
    const saved = keepUnknown(stored, { ...DEFAULT_SETTINGS, learnFromPicks: false })
    expect(saved).toMatchObject({ fromTheFuture: 1, learnFromPicks: false })
    expect(saved.appearance).toMatchObject({ sparkles: true, blur: true })
    expect(normalizeSettings(saved)).toEqual({ ...DEFAULT_SETTINGS, learnFromPicks: false })
  })

  it('starts from nothing when nothing usable was stored', () => {
    expect(keepUnknown(undefined, DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS)
  })
})
