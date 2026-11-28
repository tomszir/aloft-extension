import { fitsSync, type Keyword, MAX_CUSTOM_KEYWORDS, resolveKeywords, toStored } from './keywords'
import { normalizeSettings, type Settings } from './settings'
import {
  customThemesFitSync,
  DEFAULT_DARK_THEME_ID,
  DEFAULT_LIGHT_THEME_ID,
  makeThemeId,
  normalizeCustomThemes,
  PRESET_THEMES,
  type Theme,
  uniqueName,
} from './theme'

// A backup holds only what syncs: settings, custom themes and keywords. What
// Aloft learned from picks is browsing data and stays out, like everything
// else in storage.local.
const BACKUP_FORMAT = 'aloft-backup'
export const BACKUP_VERSION = 1
/**
 * Everything a backup holds fits in three sync items of 8 KB, so this leaves
 * room for indenting and for what a newer Aloft adds, and bounds parsing.
 */
export const MAX_BACKUP_BYTES = 64 * 1024

export interface BackupContents {
  settings: Settings
  themes: readonly Theme[]
  keywords: readonly Keyword[]
}

export function exportBackup(contents: BackupContents): string {
  return JSON.stringify(
    {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      settings: contents.settings,
      themes: contents.themes,
      // Built-ins only where they differ, so a restore picks up built-ins a
      // later Aloft adds.
      keywords: toStored(contents.keywords),
    },
    null,
    2,
  )
}

/** What a file holds, each part read as storage is; a part the file lacks is left out. */
export interface Backup {
  /** From a newer Aloft: read the same way, but some of it may not carry over. */
  newer: boolean
  settings?: Settings
  themes?: Theme[]
  keywords?: Keyword[]
}

export type BackupError = 'too-large' | 'not-json' | 'invalid'
export type BackupRead = { ok: true; backup: Backup } | { ok: false; error: BackupError }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * The file is untrusted, and may come from an older or newer Aloft, so each
 * part goes through the normalizer every storage read uses: what's valid is
 * kept, field by field, and the rest falls back.
 */
export function readBackup(text: string): BackupRead {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) {
    return { ok: false, error: 'too-large' }
  }
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, error: 'not-json' }
  }
  if (!isRecord(json) || json.format !== BACKUP_FORMAT) return { ok: false, error: 'invalid' }
  const version = json.version
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, error: 'invalid' }
  }
  const backup: Backup = { newer: version > BACKUP_VERSION }
  if (isRecord(json.settings)) backup.settings = normalizeSettings(json.settings)
  if (Array.isArray(json.themes)) backup.themes = normalizeCustomThemes(json.themes)
  if (isRecord(json.keywords)) backup.keywords = resolveKeywords(json.keywords)
  if (!backup.settings && !backup.themes && !backup.keywords) return { ok: false, error: 'invalid' }
  return { ok: true, backup }
}

export interface RestoreSummary {
  /** The file's settings differ from the ones in use. */
  settings: boolean
  themesAdded: number
  /** Left out: no room in sync for them. */
  themesSkipped: number
  keywordsAdded: number
  keywordsSkipped: number
  /** Kept, but switched off under a new keyword, because another one has theirs. */
  keywordsSwitchedOff: number
  /** The built-in keywords' changes differ from the ones in use. */
  builtIns: boolean
}

/** What to save, each part only when it changes, and what that amounts to. */
export interface RestorePlan {
  settings?: Settings
  themes?: Theme[]
  keywords?: Keyword[]
  summary: RestoreSummary
}

export const restoreChangesNothing = (plan: RestorePlan): boolean =>
  !plan.settings && !plan.themes && !plan.keywords

const PRESET_IDS = new Set(PRESET_THEMES.map((t) => t.id))

const sameTheme = (a: Theme, b: Theme): boolean =>
  a.name === b.name &&
  a.scheme === b.scheme &&
  a.radius === b.radius &&
  JSON.stringify(a.colors) === JSON.stringify(b.colors)

interface ThemeMerge {
  themes: Theme[]
  /** A file's theme id to the id it has now. */
  ids: Map<string, string>
  added: number
  skipped: number
}

/**
 * The file's themes added after the ones already here, which are never
 * removed: one that's already here (same name and look) isn't added again, one
 * whose id or name is taken gets a new one, and once sync's 16 themes or 8 KB
 * are full the rest are left out. The themes the file's settings use go first,
 * so they're the last to be left out.
 */
function mergeThemes(
  current: readonly Theme[],
  incoming: readonly Theme[],
  used: readonly string[],
): ThemeMerge {
  const ordered = [
    ...incoming.filter((t) => used.includes(t.id)),
    ...incoming.filter((t) => !used.includes(t.id)),
  ]
  const merge: ThemeMerge = { themes: [...current], ids: new Map(), added: 0, skipped: 0 }
  for (const theme of ordered) {
    const same = merge.themes.find((t) => sameTheme(t, theme))
    if (same) {
      merge.ids.set(theme.id, same.id)
      continue
    }
    const all = [...PRESET_THEMES, ...merge.themes]
    const taken = new Set(all.map((t) => t.id))
    const name = uniqueName(theme.name, all)
    const id = taken.has(theme.id) ? makeThemeId(name, taken) : theme.id
    const next = { ...theme, id, name }
    if (!customThemesFitSync([...merge.themes, next])) {
      merge.skipped++
      continue
    }
    merge.themes.push(next)
    merge.ids.set(theme.id, id)
    merge.added++
  }
  return merge
}

const sameKeyword = (a: Keyword, b: Keyword): boolean =>
  a.name === b.name && a.keyword === b.keyword && a.url === b.url

function freeWord(word: string, taken: ReadonlySet<string>): string {
  for (let n = 2; ; n++) {
    const candidate = `${word.slice(0, 21)}-${n}`
    if (!taken.has(candidate)) return candidate
  }
}

function freeId(id: string, taken: ReadonlySet<string>): string {
  for (let n = 2; ; n++) {
    const candidate = `${id.slice(0, 44)}-${n}`
    if (!taken.has(candidate)) return candidate
  }
}

/**
 * The built-ins as the file has them, then the user's own keywords, then the
 * file's own that aren't here yet. Nobody's own keyword is dropped: one whose
 * keyword another already has is switched off under a free one, as resetting
 * the built-ins does, and one whose id is taken gets a new id. Past sync's
 * limits (30 of the user's own, 8 KB) the file's extra keywords are left out.
 */
function mergeKeywords(current: readonly Keyword[], incoming: readonly Keyword[]) {
  const out = incoming.filter((k) => k.builtIn)
  let switchedOff = 0
  // `keyword` as it can go after `out`: a free id, and a free keyword or off.
  const fitted = (keyword: Keyword): Keyword => {
    const ids = new Set(out.map((k) => k.id))
    const words = new Set(out.map((k) => k.keyword))
    let next = ids.has(keyword.id) ? { ...keyword, id: freeId(keyword.id, ids) } : keyword
    if (words.has(next.keyword))
      next = { ...next, keyword: freeWord(next.keyword, words), enabled: false }
    return next
  }
  for (const keyword of current.filter((k) => !k.builtIn)) {
    const next = fitted(keyword)
    if (next.keyword !== keyword.keyword) switchedOff++
    out.push(next)
  }

  let added = 0
  let skipped = 0
  for (const keyword of incoming.filter((k) => !k.builtIn)) {
    if (out.some((k) => sameKeyword(k, keyword))) continue
    const next = fitted(keyword)
    const own = out.filter((k) => !k.builtIn).length + 1
    if (own > MAX_CUSTOM_KEYWORDS || !fitsSync(toStored([...out, next]))) {
      skipped++
      continue
    }
    if (next.keyword !== keyword.keyword) switchedOff++
    out.push(next)
    added++
  }
  return { keywords: out, added, skipped, switchedOff }
}

export interface RestoreCurrent {
  settings: Settings
  themes: readonly Theme[]
  keywords: readonly Keyword[]
}

/**
 * How `backup` lands on what's in use. Settings are replaced, with their
 * theme choices pointed at where the file's themes ended up; themes and the
 * user's own keywords are added to; the built-in keywords take the file's
 * changes.
 */
export function planRestore(backup: Backup, current: RestoreCurrent): RestorePlan {
  const summary: RestoreSummary = {
    settings: false,
    themesAdded: 0,
    themesSkipped: 0,
    keywordsAdded: 0,
    keywordsSkipped: 0,
    keywordsSwitchedOff: 0,
    builtIns: false,
  }
  const plan: RestorePlan = { summary }

  const appearance = backup.settings?.appearance
  const used = appearance ? [appearance.lightTheme, appearance.darkTheme] : []
  let themes: readonly Theme[] = current.themes
  let themeIds = new Map<string, string>()
  if (backup.themes) {
    const merge = mergeThemes(current.themes, backup.themes, used)
    themes = merge.themes
    themeIds = merge.ids
    summary.themesAdded = merge.added
    summary.themesSkipped = merge.skipped
    if (merge.added > 0) plan.themes = merge.themes
  }

  if (backup.settings && appearance) {
    const known = new Set([...PRESET_IDS, ...themes.map((t) => t.id)])
    const fileIds = new Set(backup.themes?.map((t) => t.id))
    // A theme the file has but that was left out isn't the one of that id
    // here, if there is one.
    const resolve = (id: string, fallback: string) => {
      const mapped = themeIds.get(id)
      if (mapped) return mapped
      return known.has(id) && !fileIds.has(id) ? id : fallback
    }
    const settings: Settings = {
      ...backup.settings,
      appearance: {
        ...appearance,
        lightTheme: resolve(appearance.lightTheme, DEFAULT_LIGHT_THEME_ID),
        darkTheme: resolve(appearance.darkTheme, DEFAULT_DARK_THEME_ID),
      },
    }
    if (JSON.stringify(settings) !== JSON.stringify(current.settings)) {
      plan.settings = settings
      summary.settings = true
    }
  }

  if (backup.keywords) {
    const merge = mergeKeywords(current.keywords, backup.keywords)
    summary.keywordsAdded = merge.added
    summary.keywordsSkipped = merge.skipped
    summary.keywordsSwitchedOff = merge.switchedOff
    const before = toStored(current.keywords)
    const after = toStored(merge.keywords)
    summary.builtIns = JSON.stringify(before.builtIn) !== JSON.stringify(after.builtIn)
    if (JSON.stringify(before) !== JSON.stringify(after)) plan.keywords = merge.keywords
  }
  return plan
}
