import * as v from 'valibot'
import { DEFAULT_DARK_THEME_ID, DEFAULT_LIGHT_THEME_ID } from './theme'

// Settings sync between devices that may run different Aloft versions, so
// every read goes through normalizeSettings instead of trusting storage.
export const SETTINGS_VERSION = 1

const ThemeId = v.pipe(v.string(), v.regex(/^[a-z0-9-]{1,40}$/))

export const SettingsSchema = v.object({
  /** Shift+Enter always does the other one. */
  enterOpensIn: v.picklist(['new-tab', 'current-tab']),
  switchToOpenTabs: v.boolean(),
  /** Puts the page picked most often for the same text at the top. */
  learnFromPicks: v.boolean(),
  /** After an update, a "What's new" link in the palette's footer, once. */
  whatsNewInAloft: v.boolean(),
  sources: v.object({
    tabs: v.boolean(),
    history: v.boolean(),
    bookmarks: v.boolean(),
    recentlyClosed: v.boolean(),
  }),
  // Helium 0.22.2+ syncs pins across windows and remembers each pin's address
  // itself (imputnet/helium#2931), so Aloft only shows them.
  pinned: v.object({
    showInAloft: v.boolean(),
  }),
  appearance: v.object({
    colorScheme: v.picklist(['system', 'light', 'dark']),
    lightTheme: ThemeId,
    darkTheme: ThemeId,
    position: v.picklist(['upper-third', 'center']),
    blur: v.boolean(),
  }),
})

export type Settings = v.InferOutput<typeof SettingsSchema>

export const DEFAULT_SETTINGS: Settings = {
  enterOpensIn: 'new-tab',
  switchToOpenTabs: true,
  learnFromPicks: true,
  whatsNewInAloft: true,
  sources: { tabs: true, history: true, bookmarks: true, recentlyClosed: true },
  pinned: { showInAloft: true },
  appearance: {
    colorScheme: 'system',
    lightTheme: DEFAULT_LIGHT_THEME_ID,
    darkTheme: DEFAULT_DARK_THEME_ID,
    position: 'upper-third',
    blur: true,
  },
}

type PlainObject = Record<string, unknown>

const isPlainObject = (value: unknown): value is PlainObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// Unknown keys are dropped so fields from a newer version or a corrupted store
// never reach the UI.
function mergeKnown(defaults: PlainObject, raw: unknown): PlainObject {
  const source = isPlainObject(raw) ? raw : {}
  const out: PlainObject = {}
  for (const [key, fallback] of Object.entries(defaults)) {
    const value = source[key]
    if (isPlainObject(fallback)) {
      out[key] = mergeKnown(fallback, value)
    } else {
      out[key] = typeof value === typeof fallback ? value : fallback
    }
  }
  return out
}

function getAt(obj: unknown, path: readonly PropertyKey[]): unknown {
  let current = obj
  for (const key of path) {
    if (!isPlainObject(current)) return undefined
    current = current[key as string]
  }
  return current
}

function setAt(obj: PlainObject, path: readonly PropertyKey[], value: unknown): void {
  let current: PlainObject = obj
  for (const key of path.slice(0, -1)) {
    const next = current[key as string]
    if (!isPlainObject(next)) return
    current = next
  }
  const last = path.at(-1)
  if (last !== undefined) current[last as string] = value
}

/** Invalid fields reset one by one, so a single bad value doesn't wipe the rest. */
export function normalizeSettings(raw: unknown): Settings {
  const merged = mergeKnown(DEFAULT_SETTINGS, raw)
  const first = v.safeParse(SettingsSchema, merged)
  if (first.success) return first.output

  for (const issue of first.issues) {
    const path = (issue.path ?? []).map((item) => item.key as PropertyKey)
    if (path.length === 0) return structuredClone(DEFAULT_SETTINGS)
    setAt(merged, path, structuredClone(getAt(DEFAULT_SETTINGS, path)))
  }
  const second = v.safeParse(SettingsSchema, merged)
  return second.success ? second.output : structuredClone(DEFAULT_SETTINGS)
}

/**
 * `settings` written over what was stored, keeping keys this version doesn't
 * know: another device on a newer Aloft may have saved them, and dropping
 * them here would reset that device's choices.
 */
export function keepUnknown(stored: unknown, settings: Settings): Record<string, unknown> {
  return mergeOver(stored, settings)
}

function mergeOver(stored: unknown, known: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = isPlainObject(stored) ? { ...stored } : {}
  if (!isPlainObject(known)) return out
  for (const [key, value] of Object.entries(known)) {
    out[key] = isPlainObject(value) ? mergeOver(out[key], value) : value
  }
  return out
}
