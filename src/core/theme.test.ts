import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import {
  contrastIssues,
  contrastRatio,
  DEFAULT_DARK_THEME_ID,
  DEFAULT_LIGHT_THEME_ID,
  deriveTokens,
  exportTheme,
  importTheme,
  makeThemeId,
  mix,
  PRESET_THEMES,
  resolveTheme,
  ThemeSchema,
} from './theme'

const heliumDark = PRESET_THEMES.find((t) => t.id === DEFAULT_DARK_THEME_ID)
if (!heliumDark) throw new Error('missing preset')

describe('presets', () => {
  it.each(PRESET_THEMES.map((t) => [t.name, t] as const))('%s is valid', (_name, theme) => {
    expect(v.safeParse(ThemeSchema, theme).success).toBe(true)
  })

  it.each(PRESET_THEMES.map((t) => [t.name, t] as const))(
    '%s meets 4.5:1 for all text',
    (_name, theme) => {
      expect(contrastIssues(theme.colors)).toEqual([])
    },
  )

  it.each(PRESET_THEMES.map((t) => [t.name, t] as const))(
    '%s keeps the selected row keycap visible and readable',
    (_name, theme) => {
      const tokens = deriveTokens(theme)
      expect(contrastRatio(tokens.keycapSelected, tokens.selected)).toBeGreaterThan(1.25)
      expect(contrastRatio(tokens.text, tokens.keycapSelected)).toBeGreaterThanOrEqual(4.5)
    },
  )

  it('has unique ids and both defaults', () => {
    const ids = PRESET_THEMES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain(DEFAULT_DARK_THEME_ID)
    expect(ids).toContain(DEFAULT_LIGHT_THEME_ID)
  })
})

describe('resolveTheme', () => {
  const choice = { colorScheme: 'system', lightTheme: 'paper', darkTheme: 'moss' } as const

  it('follows the system in system mode', () => {
    expect(resolveTheme(choice, true).id).toBe('moss')
    expect(resolveTheme(choice, false).id).toBe('paper')
  })

  it('ignores the system when forced', () => {
    expect(resolveTheme({ ...choice, colorScheme: 'light' }, true).id).toBe('paper')
    expect(resolveTheme({ ...choice, colorScheme: 'dark' }, false).id).toBe('moss')
  })

  it('falls back to the Helium preset when a saved theme is gone', () => {
    expect(resolveTheme({ ...choice, darkTheme: 'custom-deleted' }, true).id).toBe(
      DEFAULT_DARK_THEME_ID,
    )
    expect(resolveTheme({ ...choice, lightTheme: 'custom-deleted' }, false, []).id).toBe(
      DEFAULT_LIGHT_THEME_ID,
    )
  })
})

describe('color math', () => {
  it('computes WCAG contrast', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5)
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5)
  })

  it('mixes colors', () => {
    expect(mix('#000000', '#FFFFFF', 0)).toBe('#000000')
    expect(mix('#000000', '#FFFFFF', 1)).toBe('#FFFFFF')
    expect(mix('#000000', '#FFFFFF', 0.5)).toBe('#808080')
  })

  it('picks readable text for the accent', () => {
    for (const theme of PRESET_THEMES) {
      const t = deriveTokens(theme)
      expect(contrastRatio(t.onAccent, t.accent)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('keeps chip text readable on the accent wash, changing the accent only when needed', () => {
    for (const theme of PRESET_THEMES) {
      const t = deriveTokens(theme)
      expect(contrastRatio(t.accentSoftText, t.accentSoft)).toBeGreaterThanOrEqual(4.5)
    }
    expect(deriveTokens(heliumDark).accentSoftText).toBe(heliumDark.colors.accent)
  })
})

describe('import / export', () => {
  it('round-trips a theme without its id', () => {
    const result = importTheme(exportTheme(heliumDark))
    expect(result.ok).toBe(true)
    if (result.ok) {
      const { id: _id, ...rest } = heliumDark
      expect(result.theme).toEqual(rest)
      expect(result.theme).not.toHaveProperty('id')
    }
  })

  it('rejects non-JSON', () => {
    expect(importTheme('{nope')).toMatchObject({ ok: false, error: 'not-json' })
  })

  it('rejects oversized input before parsing', () => {
    expect(importTheme(' '.repeat(9 * 1024))).toMatchObject({ ok: false, error: 'too-large' })
  })

  it('rejects bad colors and says where', () => {
    const bad = JSON.parse(exportTheme(heliumDark))
    bad.theme.colors.text = 'red'
    const result = importTheme(JSON.stringify(bad))
    expect(result).toMatchObject({ ok: false, error: 'invalid' })
    if (!result.ok) expect(result.message).toContain('theme.colors.text')
  })

  it('accepts a low-contrast theme but reports it', () => {
    const low = JSON.parse(exportTheme(heliumDark))
    low.theme.colors.muted = '#3A3C3C'
    const result = importTheme(JSON.stringify(low))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.contrast.length).toBeGreaterThan(0)
  })
})

describe('makeThemeId', () => {
  it('slugs names and avoids clashes', () => {
    expect(makeThemeId('My Theme!', new Set())).toBe('custom-my-theme')
    expect(makeThemeId('My Theme', new Set(['custom-my-theme']))).toBe('custom-my-theme-2')
    expect(makeThemeId('✨', new Set())).toBe('custom-theme')
  })

  it('always produces a valid id', () => {
    const id = makeThemeId('x'.repeat(100), new Set())
    expect(v.safeParse(ThemeSchema.entries.id, id).success).toBe(true)
  })
})
