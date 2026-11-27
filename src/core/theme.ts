import * as v from 'valibot'

// Themes hold only six colors and a radius; the rest of the tokens are derived
// so a theme stays small enough to edit by hand and share as JSON.

const Hex = v.pipe(v.string(), v.regex(/^#[0-9a-fA-F]{6}$/, 'Expected a color like #1A1C1C'))

export const ThemeColorsSchema = v.object({
  panel: Hex,
  /** Also the hovered tile, so text must stay readable on it. */
  selected: Hex,
  border: Hex,
  text: Hex,
  /** Used for small text (URLs, hints), so it has to meet 4.5:1 too. */
  muted: Hex,
  accent: Hex,
})

export const ThemeSchema = v.object({
  id: v.pipe(v.string(), v.regex(/^[a-z0-9-]{1,40}$/)),
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(40)),
  scheme: v.picklist(['light', 'dark']),
  colors: ThemeColorsSchema,
  radius: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(24)),
})

export type ThemeColors = v.InferOutput<typeof ThemeColorsSchema>
export type Theme = v.InferOutput<typeof ThemeSchema>

export const DEFAULT_DARK_THEME_ID = 'helium-dark'
export const DEFAULT_LIGHT_THEME_ID = 'helium-light'

export const PRESET_THEMES: readonly Theme[] = [
  {
    id: 'helium-dark',
    name: 'Default Dark',
    scheme: 'dark',
    radius: 14,
    colors: {
      panel: '#262828',
      selected: '#363838',
      border: '#3A3C3C',
      text: '#E8E8E8',
      muted: '#A8A8A8',
      accent: '#8AB4F8',
    },
  },
  {
    id: 'helium-light',
    name: 'Default Light',
    scheme: 'light',
    radius: 14,
    colors: {
      panel: '#FFFFFF',
      selected: '#EEF0F0',
      border: '#DADCDC',
      text: '#1C1E1E',
      muted: '#5F6262',
      accent: '#2563EB',
    },
  },
  {
    id: 'graphite',
    name: 'Graphite',
    scheme: 'dark',
    radius: 14,
    colors: {
      panel: '#161616',
      selected: '#262626',
      border: '#2A2A2A',
      text: '#EDEDED',
      muted: '#A3A3A3',
      accent: '#EDEDED',
    },
  },
  {
    id: 'paper',
    name: 'Paper',
    scheme: 'light',
    radius: 14,
    colors: {
      panel: '#FBF8F3',
      selected: '#F1EBE1',
      border: '#E4DDD2',
      text: '#2A2621',
      muted: '#6B6358',
      accent: '#B4532A',
    },
  },
  {
    id: 'moss',
    name: 'Moss',
    scheme: 'dark',
    radius: 14,
    colors: {
      panel: '#1E2420',
      selected: '#2C3530',
      border: '#323B35',
      text: '#E4EAE5',
      muted: '#A3AFA7',
      accent: '#9ED7A8',
    },
  },
  {
    id: 'dusk',
    name: 'Dusk',
    scheme: 'dark',
    radius: 14,
    colors: {
      panel: '#221F2B',
      selected: '#312C40',
      border: '#36314A',
      text: '#E9E6F2',
      muted: '#ABA5BD',
      accent: '#C9B6F2',
    },
  },
]

export interface ThemeChoice {
  colorScheme: 'system' | 'light' | 'dark'
  lightTheme: string
  darkTheme: string
}

/** Falls back to the default presets so a deleted custom theme never leaves Aloft unstyled. */
export function resolveTheme(
  choice: ThemeChoice,
  systemPrefersDark: boolean,
  themes: readonly Theme[] = PRESET_THEMES,
): Theme {
  const dark =
    choice.colorScheme === 'dark' || (choice.colorScheme === 'system' && systemPrefersDark)
  const wantedId = dark ? choice.darkTheme : choice.lightTheme
  const fallbackId = dark ? DEFAULT_DARK_THEME_ID : DEFAULT_LIGHT_THEME_ID
  const found = themes.find((t) => t.id === wantedId) ?? themes.find((t) => t.id === fallbackId)
  if (found) return found
  const preset = PRESET_THEMES.find((t) => t.id === fallbackId)
  if (!preset) throw new Error(`Missing built-in theme ${fallbackId}`)
  return preset
}

type Rgb = readonly [number, number, number]

export function parseHex(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

function toHex([r, g, b]: Rgb): string {
  const part = (c: number) => Math.round(c).toString(16).padStart(2, '0')
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase()
}

export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a)
  const [br, bg, bb] = parseHex(b)
  const lerp = (x: number, y: number) => x + (y - x) * t
  return toHex([lerp(ar, br), lerp(ag, bg), lerp(ab, bb)])
}

// Light accents are often only just readable on white, so a tint behind them
// can drop small text below WCAG AA. Moves `color` toward `toward` in small
// steps, keeping as much of the original as it can.
function readableOn(color: string, background: string, toward: string): string {
  for (let step = 0; step <= 20; step++) {
    const candidate = mix(color, toward, step / 20)
    if (contrastRatio(candidate, background) >= 4.5) return candidate
  }
  return toward
}

const linear = (channel: number): number => {
  const s = channel / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

/** WCAG 2.x relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex)
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

export interface ThemeTokens {
  panel: string
  selected: string
  border: string
  divider: string
  text: string
  muted: string
  accent: string
  /** A wash of the accent over the panel, for chips. */
  accentSoft: string
  /** The accent, darkened or lightened toward the text until it reads on accentSoft. */
  accentSoftText: string
  onAccent: string
  keycap: string
  keycapText: string
  /** A keycap on the selected row, which `keycap` all but disappears into. */
  keycapSelected: string
  radius: number
  rowRadius: number
  tileRadius: number
  scheme: 'light' | 'dark'
}

export function deriveTokens(theme: Theme): ThemeTokens {
  const c = theme.colors
  const accentSoft = mix(c.panel, c.accent, 0.16)
  const onAccent =
    contrastRatio(c.accent, '#141414') >= contrastRatio(c.accent, '#FFFFFF') ? '#141414' : '#FFFFFF'
  return {
    panel: c.panel,
    selected: c.selected,
    border: c.border,
    divider: mix(c.panel, c.border, 0.6),
    text: c.text,
    muted: c.muted,
    accent: c.accent,
    accentSoft,
    accentSoftText: readableOn(c.accent, accentSoft, c.text),
    onAccent,
    keycap: mix(c.panel, c.selected, 0.7),
    keycapText: mix(c.muted, c.text, 0.5),
    keycapSelected: mix(c.selected, c.text, 0.14),
    radius: theme.radius,
    rowRadius: Math.round(theme.radius * 0.65),
    tileRadius: Math.round(theme.radius * 0.8),
    scheme: theme.scheme,
  }
}

export function tokensToCssVars(tokens: ThemeTokens): Record<`--al-${string}`, string> {
  return {
    '--al-panel': tokens.panel,
    '--al-selected': tokens.selected,
    '--al-border': tokens.border,
    '--al-divider': tokens.divider,
    '--al-text': tokens.text,
    '--al-muted': tokens.muted,
    '--al-accent': tokens.accent,
    '--al-accent-soft': tokens.accentSoft,
    '--al-accent-soft-text': tokens.accentSoftText,
    '--al-on-accent': tokens.onAccent,
    '--al-keycap': tokens.keycap,
    '--al-keycap-text': tokens.keycapText,
    '--al-keycap-selected': tokens.keycapSelected,
    '--al-radius': `${tokens.radius}px`,
    '--al-row-radius': `${tokens.rowRadius}px`,
    '--al-tile-radius': `${tokens.tileRadius}px`,
  }
}

export const MIN_TEXT_CONTRAST = 4.5

export interface ContrastIssue {
  foreground: keyof ThemeColors
  background: keyof ThemeColors
  ratio: number
}

/** Pairs that carry small text in the palette and must reach 4.5:1. */
const TEXT_PAIRS: readonly (readonly [keyof ThemeColors, keyof ThemeColors])[] = [
  ['text', 'panel'],
  ['text', 'selected'],
  ['muted', 'panel'],
  ['muted', 'selected'],
]

export function contrastIssues(colors: ThemeColors): ContrastIssue[] {
  return TEXT_PAIRS.flatMap(([foreground, background]) => {
    const ratio = contrastRatio(colors[foreground], colors[background])
    return ratio < MIN_TEXT_CONTRAST ? [{ foreground, background, ratio }] : []
  })
}

const EXPORT_FORMAT = 'aloft-theme'
const EXPORT_VERSION = 1
/** Imported text comes from users and the internet: keep parsing bounded. */
const MAX_IMPORT_BYTES = 8 * 1024

const ExportSchema = v.object({
  format: v.literal(EXPORT_FORMAT),
  version: v.literal(EXPORT_VERSION),
  theme: v.object({
    name: ThemeSchema.entries.name,
    scheme: ThemeSchema.entries.scheme,
    colors: ThemeColorsSchema,
    radius: ThemeSchema.entries.radius,
  }),
})

export function exportTheme(theme: Theme): string {
  const { name, scheme, colors, radius } = theme
  return JSON.stringify(
    { format: EXPORT_FORMAT, version: EXPORT_VERSION, theme: { name, scheme, colors, radius } },
    null,
    2,
  )
}

export type ImportResult =
  | { ok: true; theme: Omit<Theme, 'id'>; contrast: ContrastIssue[] }
  | { ok: false; error: 'too-large' | 'not-json' | 'invalid'; message: string }

/** No id comes from the file, so an import can never overwrite a preset or a saved theme. */
export function importTheme(text: string): ImportResult {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) {
    return { ok: false, error: 'too-large', message: 'Theme files are at most 8 KB.' }
  }
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, error: 'not-json', message: 'This isn’t valid JSON.' }
  }
  const result = v.safeParse(ExportSchema, json)
  if (!result.success) {
    const first = result.issues[0]
    const where = first?.path?.map((p) => String(p.key)).join('.') ?? 'file'
    return { ok: false, error: 'invalid', message: `${where}: ${first?.message ?? 'invalid'}` }
  }
  const theme = result.output.theme
  return { ok: true, theme, contrast: contrastIssues(theme.colors) }
}

export function makeThemeId(name: string, taken: ReadonlySet<string>): string {
  const base =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'theme'
  let id = `custom-${base}`.slice(0, 40)
  for (let n = 2; taken.has(id); n++) id = `custom-${base}-${n}`.slice(0, 40)
  return id
}

/** Custom themes live in one sync item, which holds 8 KB; these fit with room. */
export const MAX_CUSTOM_THEMES = 16
const SYNC_ITEM_BYTES = 8192
const PRESET_IDS = new Set(PRESET_THEMES.map((t) => t.id))

/**
 * Stored custom themes, keeping each valid one: they sync from other devices
 * and may come from other versions, so nothing is trusted.
 */
export function normalizeCustomThemes(raw: unknown): Theme[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const themes: Theme[] = []
  for (const item of raw) {
    const parsed = v.safeParse(ThemeSchema, item)
    if (!parsed.success) continue
    const theme = parsed.output
    if (PRESET_IDS.has(theme.id) || seen.has(theme.id)) continue
    seen.add(theme.id)
    themes.push(theme)
  }
  return themes.slice(0, MAX_CUSTOM_THEMES)
}

export function customThemesFitSync(themes: readonly Theme[]): boolean {
  const bytes = new TextEncoder().encode(`themes${JSON.stringify(themes)}`).length
  return themes.length <= MAX_CUSTOM_THEMES && bytes <= SYNC_ITEM_BYTES
}

/** A theme being edited, for the settings preview's address. */
export function encodePreviewTheme(theme: Theme): string {
  return encodeURIComponent(JSON.stringify(theme))
}

export function decodePreviewTheme(text: string): Theme | undefined {
  try {
    const parsed = v.safeParse(ThemeSchema, JSON.parse(decodeURIComponent(text)))
    return parsed.success ? parsed.output : undefined
  } catch {
    return undefined
  }
}
