import { describe, expect, it } from 'vitest'
import {
  BACKUP_VERSION,
  type Backup,
  exportBackup,
  MAX_BACKUP_BYTES,
  planRestore,
  type RestoreCurrent,
  readBackup,
  restoreChangesNothing,
} from './backup'
import { BUILT_IN_KEYWORDS, type Keyword, MAX_CUSTOM_KEYWORDS, resolveKeywords } from './keywords'
import { DEFAULT_SETTINGS, type Settings } from './settings'
import { MAX_CUSTOM_THEMES, PRESET_THEMES, type Theme } from './theme'

const theme = (id: string, name = id, accent = '#123456'): Theme => ({
  id,
  name,
  scheme: 'dark',
  radius: 10,
  colors: {
    panel: '#101010',
    selected: '#202020',
    border: '#303030',
    text: '#F0F0F0',
    muted: '#B0B0B0',
    accent,
  },
})

const custom = (id: string, word: string, url = `https://${word}.example/?q=%s`): Keyword => ({
  id,
  name: word.toUpperCase(),
  keyword: word,
  url,
  kind: 'search',
  enabled: true,
  builtIn: false,
})

const withDark = (id: string): Settings => ({
  ...DEFAULT_SETTINGS,
  appearance: { ...DEFAULT_SETTINGS.appearance, colorScheme: 'dark', darkTheme: id },
})

const nothing: RestoreCurrent = {
  settings: DEFAULT_SETTINGS,
  themes: [],
  keywords: BUILT_IN_KEYWORDS,
}

function read(value: unknown): Backup {
  const result = readBackup(JSON.stringify(value))
  if (!result.ok) throw new Error(result.error)
  return result.backup
}

describe('exportBackup / readBackup', () => {
  it('round-trips settings, themes and keywords', () => {
    const settings = withDark('custom-ember')
    const themes = [theme('custom-ember', 'Ember')]
    const keywords = [
      ...BUILT_IN_KEYWORDS.map((k) => (k.id === 'youtube' ? { ...k, enabled: false } : k)),
      custom('custom-docs', 'docs'),
    ]
    const result = readBackup(exportBackup({ settings, themes, keywords }))
    expect(result).toEqual({ ok: true, backup: { newer: false, settings, themes, keywords } })
  })

  it('marks the file and its version, and stores only changed built-ins', () => {
    const keywords = BUILT_IN_KEYWORDS.map((k) => (k.id === 'github' ? { ...k, keyword: 'g' } : k))
    const json = JSON.parse(exportBackup({ settings: DEFAULT_SETTINGS, themes: [], keywords }))
    expect(json).toMatchObject({ format: 'aloft-backup', version: BACKUP_VERSION })
    expect(json.keywords).toEqual({ builtIn: { github: { keyword: 'g' } }, custom: [] })
  })

  it('holds nothing but settings, themes and keywords', () => {
    const json = JSON.parse(
      exportBackup({ settings: DEFAULT_SETTINGS, themes: [], keywords: BUILT_IN_KEYWORDS }),
    )
    expect(Object.keys(json).sort()).toEqual([
      'format',
      'keywords',
      'settings',
      'themes',
      'version',
    ])
  })

  it('refuses a file over the size limit before parsing it', () => {
    const text = `{"format":"aloft-backup","version":1,"pad":"${'x'.repeat(MAX_BACKUP_BYTES)}"}`
    expect(readBackup(text)).toEqual({ ok: false, error: 'too-large' })
  })

  it('refuses text that is not JSON', () => {
    expect(readBackup('{ settings: ')).toEqual({ ok: false, error: 'not-json' })
  })

  it.each([
    ['a theme file', { format: 'aloft-theme', version: 1, theme: {} }],
    ['an array', [1, 2]],
    ['no format', { version: 1, settings: {} }],
    ['no version', { format: 'aloft-backup', settings: {} }],
    [
      'a version that is not a whole number',
      { format: 'aloft-backup', version: '1', settings: {} },
    ],
    ['nothing Aloft can use', { format: 'aloft-backup', version: 1, settings: 'yes', themes: {} }],
  ])('refuses %s', (_, value) => {
    expect(readBackup(JSON.stringify(value))).toEqual({ ok: false, error: 'invalid' })
  })

  it('reads a file from a newer Aloft as far as it can, dropping what it does not know', () => {
    const backup = read({
      format: 'aloft-backup',
      version: BACKUP_VERSION + 1,
      settings: { learnFromPicks: false, fromTheFuture: true, sources: { tabs: 'maybe' } },
      themes: [theme('custom-a'), { id: 'custom-b', shape: 'hexagon' }],
      keywords: { builtIn: {}, custom: [], aliases: ['x'] },
      learned: [{ text: 'never', url: 'https://example.com' }],
    })
    expect(backup.newer).toBe(true)
    expect(backup.settings).toEqual({ ...DEFAULT_SETTINGS, learnFromPicks: false })
    expect(backup.themes).toEqual([theme('custom-a')])
    expect(backup.keywords).toEqual(BUILT_IN_KEYWORDS)
    expect(backup).not.toHaveProperty('learned')
  })

  it('reads an older file that has only some of the parts', () => {
    const backup = read({ format: 'aloft-backup', version: 1, settings: { blur: false } })
    expect(backup.settings).toEqual(DEFAULT_SETTINGS)
    expect(backup.themes).toBeUndefined()
    expect(backup.keywords).toBeUndefined()
  })

  it('normalizes every part like storage reads do', () => {
    const backup = read({
      format: 'aloft-backup',
      version: 1,
      settings: { appearance: { font: 'comic-sans', density: 'compact' } },
      themes: [theme('helium-dark'), theme('custom-a'), theme('custom-a', 'Again')],
      keywords: {
        builtIn: { youtube: { enabled: false, url: 'javascript:alert(1)//%s' } },
        custom: [{ id: 'custom-x', name: 'X', keyword: 'has space', url: 'https://x/%s' }],
      },
    })
    expect(backup.settings?.appearance).toMatchObject({ font: 'system', density: 'compact' })
    expect(backup.themes?.map((t) => t.id)).toEqual(['custom-a'])
    expect(backup.keywords).toEqual(resolveKeywords({ builtIn: { youtube: { enabled: false } } }))
  })
})

describe('planRestore', () => {
  it('changes nothing when the file matches what is in use', () => {
    const current: RestoreCurrent = {
      settings: withDark('custom-a'),
      themes: [theme('custom-a')],
      keywords: [...BUILT_IN_KEYWORDS, custom('custom-docs', 'docs')],
    }
    const plan = planRestore(read(JSON.parse(exportBackup(current))), current)
    expect(restoreChangesNothing(plan)).toBe(true)
  })

  it('replaces the settings', () => {
    const settings = { ...DEFAULT_SETTINGS, enterOpensIn: 'current-tab' as const }
    const plan = planRestore({ newer: false, settings }, nothing)
    expect(plan.settings).toEqual(settings)
    expect(plan.summary.settings).toBe(true)
  })

  describe('themes', () => {
    it('adds the file’s themes after the ones here, keeping their ids', () => {
      const current = { ...nothing, themes: [theme('custom-mine')] }
      const plan = planRestore(
        { newer: false, themes: [theme('custom-a', 'A', '#AAAAAA')] },
        current,
      )
      expect(plan.themes?.map((t) => t.id)).toEqual(['custom-mine', 'custom-a'])
      expect(plan.summary).toMatchObject({ themesAdded: 1, themesSkipped: 0 })
    })

    it('doesn’t add a theme that is already here, even under another id', () => {
      const current = { ...nothing, themes: [theme('custom-ember', 'Ember')] }
      const plan = planRestore(
        { newer: false, themes: [theme('custom-old', 'Ember')], settings: withDark('custom-old') },
        current,
      )
      expect(plan.themes).toBeUndefined()
      expect(plan.settings?.appearance.darkTheme).toBe('custom-ember')
    })

    it('gives a theme whose id or name is taken a new one, and points the settings at it', () => {
      const current = { ...nothing, themes: [theme('custom-ember', 'Ember', '#111111')] }
      const plan = planRestore(
        {
          newer: false,
          themes: [theme('custom-ember', 'Ember', '#222222')],
          settings: withDark('custom-ember'),
        },
        current,
      )
      const added = plan.themes?.[1]
      expect(added).toMatchObject({ name: 'Ember 2', colors: { accent: '#222222' } })
      expect(added?.id).not.toBe('custom-ember')
      expect(plan.settings?.appearance.darkTheme).toBe(added?.id)
    })

    it('leaves out what doesn’t fit, keeping the themes the settings use', () => {
      const here = Array.from({ length: MAX_CUSTOM_THEMES - 1 }, (_, n) =>
        theme(`custom-here-${n}`, `Here ${n}`, `#0000${(n + 16).toString(16)}`.toUpperCase()),
      )
      const file = [theme('custom-x', 'X', '#AA0000'), theme('custom-used', 'Used', '#BB0000')]
      const plan = planRestore(
        { newer: false, themes: file, settings: withDark('custom-used') },
        { ...nothing, themes: here },
      )
      expect(plan.themes?.at(-1)?.id).toBe('custom-used')
      expect(plan.themes).toHaveLength(MAX_CUSTOM_THEMES)
      expect(plan.summary).toMatchObject({ themesAdded: 1, themesSkipped: 1 })
      expect(plan.settings?.appearance.darkTheme).toBe('custom-used')
    })

    it('points the settings at the default theme when theirs was left out', () => {
      const here = Array.from({ length: MAX_CUSTOM_THEMES }, (_, n) =>
        theme(`custom-here-${n}`, `Here ${n}`, `#0000${(n + 16).toString(16)}`.toUpperCase()),
      )
      const plan = planRestore(
        {
          newer: false,
          themes: [theme('custom-here-0', 'Elsewhere', '#CC0000')],
          settings: withDark('custom-here-0'),
        },
        { ...nothing, themes: here },
      )
      expect(plan.summary.themesSkipped).toBe(1)
      expect(plan.settings?.appearance.darkTheme).toBe('helium-dark')
    })

    it('keeps settings that use a preset or a theme already here', () => {
      const preset = PRESET_THEMES.find((t) => t.id === 'moss')
      expect(preset).toBeDefined()
      const plan = planRestore(
        { newer: false, settings: withDark('moss') },
        { ...nothing, themes: [theme('custom-mine')] },
      )
      expect(plan.settings?.appearance.darkTheme).toBe('moss')
      const mine = planRestore(
        { newer: false, settings: withDark('custom-mine') },
        { ...nothing, themes: [theme('custom-mine')] },
      )
      expect(mine.settings?.appearance.darkTheme).toBe('custom-mine')
      const gone = planRestore({ newer: false, settings: withDark('custom-gone') }, nothing)
      expect(gone.settings?.appearance.darkTheme).toBe('helium-dark')
    })
  })

  describe('keywords', () => {
    it('takes the file’s built-in changes and adds its own keywords to the ones here', () => {
      const file = resolveKeywords({
        builtIn: { github: { enabled: false } },
        custom: [custom('custom-b', 'bee')],
      })
      const current = [...BUILT_IN_KEYWORDS, custom('custom-a', 'ay')]
      const plan = planRestore({ newer: false, keywords: file }, { ...nothing, keywords: current })
      expect(plan.keywords?.find((k) => k.id === 'github')?.enabled).toBe(false)
      expect(plan.keywords?.filter((k) => !k.builtIn).map((k) => k.id)).toEqual([
        'custom-a',
        'custom-b',
      ])
      expect(plan.summary).toMatchObject({ keywordsAdded: 1, builtIns: true })
    })

    it('doesn’t add a keyword that is already here', () => {
      const mine = custom('custom-a', 'ay')
      const plan = planRestore(
        { newer: false, keywords: [...BUILT_IN_KEYWORDS, { ...mine, id: 'custom-other' }] },
        { ...nothing, keywords: [...BUILT_IN_KEYWORDS, mine] },
      )
      expect(plan.keywords).toBeUndefined()
      expect(plan.summary.keywordsAdded).toBe(0)
    })

    it('gives a keyword whose id is taken a new id', () => {
      const plan = planRestore(
        { newer: false, keywords: [...BUILT_IN_KEYWORDS, custom('custom-a', 'bee')] },
        { ...nothing, keywords: [...BUILT_IN_KEYWORDS, custom('custom-a', 'ay')] },
      )
      const own = plan.keywords?.filter((k) => !k.builtIn)
      expect(own?.map((k) => [k.id, k.keyword])).toEqual([
        ['custom-a', 'ay'],
        ['custom-a-2', 'bee'],
      ])
    })

    it('switches off a keyword whose keyword is taken, under a free one', () => {
      const plan = planRestore(
        {
          newer: false,
          keywords: [...BUILT_IN_KEYWORDS, custom('custom-b', 'ay', 'https://b.example/%s')],
        },
        { ...nothing, keywords: [...BUILT_IN_KEYWORDS, custom('custom-a', 'ay')] },
      )
      expect(plan.keywords?.at(-1)).toMatchObject({
        id: 'custom-b',
        keyword: 'ay-2',
        enabled: false,
      })
      expect(plan.summary.keywordsSwitchedOff).toBe(1)
    })

    it('switches off one of yours that a built-in in the file now uses', () => {
      const file = resolveKeywords({ builtIn: { github: { keyword: 'ay' } } })
      const plan = planRestore(
        { newer: false, keywords: file },
        { ...nothing, keywords: [...BUILT_IN_KEYWORDS, custom('custom-a', 'ay')] },
      )
      expect(plan.keywords?.find((k) => k.id === 'github')?.keyword).toBe('ay')
      expect(plan.keywords?.find((k) => k.id === 'custom-a')).toMatchObject({
        keyword: 'ay-2',
        enabled: false,
      })
    })

    it('leaves out keywords past the most Aloft keeps', () => {
      const here = Array.from({ length: MAX_CUSTOM_KEYWORDS }, (_, n) =>
        custom(`custom-${n}`, `k${n}`),
      )
      const plan = planRestore(
        { newer: false, keywords: [...BUILT_IN_KEYWORDS, custom('custom-new', 'new')] },
        { ...nothing, keywords: [...BUILT_IN_KEYWORDS, ...here] },
      )
      expect(plan.keywords).toBeUndefined()
      expect(plan.summary).toMatchObject({ keywordsAdded: 0, keywordsSkipped: 1 })
    })

    it('leaves out keywords that would overflow the sync item', () => {
      const long = (n: number) =>
        custom(`custom-${n}`, `k${n}`, `https://example.com/${'p'.repeat(400)}?q=%s&n=${n}`)
      const here = Array.from({ length: 14 }, (_, n) => long(n))
      const file = Array.from({ length: 10 }, (_, n) => long(n + 100))
      const plan = planRestore(
        { newer: false, keywords: [...BUILT_IN_KEYWORDS, ...file] },
        { ...nothing, keywords: [...BUILT_IN_KEYWORDS, ...here] },
      )
      expect(plan.summary.keywordsAdded).toBeGreaterThan(0)
      expect(plan.summary.keywordsSkipped).toBeGreaterThan(0)
      expect(plan.summary.keywordsAdded + plan.summary.keywordsSkipped).toBe(10)
    })
  })
})
