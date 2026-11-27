import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEMO_KEYS, i18n, t } from './i18n'

const demoYaml = readFileSync('src/demo/locales/en.yml', 'utf8')
const yamlKeys = [...demoYaml.matchAll(/^([A-Za-z]\w*):/gm)].map((m) => m[1])

describe('demo strings', () => {
  it('lists exactly the keys in src/demo/locales/en.yml', () => {
    expect([...DEMO_KEYS].sort()).toEqual([...yamlKeys].sort())
  })

  it('fills in substitutions', () => {
    expect(t('tourStepCount', ['2', '5'])).toBe('2 / 5')
    expect(t('wouldSwitch', ['Inbox — Postbox'])).toBe('Would switch to Inbox — Postbox')
  })

  it('leaves the placeholders for markup when given none', () => {
    expect(t('tourActionsBody')).toContain('$1')
  })

  it("reads the extension's own strings for the palette", () => {
    expect(i18n.t('palettePlaceholder')).toBe('Search or enter address')
    expect(i18n.t('hintWhatsNew', ['1.0.0'])).toBe("What's new in 1.0.0")
  })
})
