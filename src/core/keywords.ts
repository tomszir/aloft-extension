import * as v from 'valibot'

/** "ask" sites take a prompt rather than a search, and their rows say so. */
export type KeywordKind = 'search' | 'ask'

export interface Keyword {
  id: string
  name: string
  /** What's typed before Space or Tab, without the optional "@". */
  keyword: string
  /** The address to open, with %s where the typed text goes. */
  url: string
  /** Opened when nothing is typed in the chip; else the address's origin. */
  home?: string
  kind: KeywordKind
  enabled: boolean
  builtIn: boolean
}

/** Typed before a keyword, it always makes a chip, even one shadowed by plain text. */
export const KEYWORD_PREFIX = '@'
export const PLACEHOLDER = '%s'

const builtIn = (
  id: string,
  name: string,
  keyword: string,
  url: string,
  extra: Partial<Pick<Keyword, 'home' | 'kind' | 'enabled'>> = {},
): Keyword => ({ id, name, keyword, url, kind: 'search', enabled: true, builtIn: true, ...extra })

// Keywords are two letters or more, and never a common word, because Space
// after a keyword makes a chip: "so cute" mustn't become a Stack Overflow
// search. Gemini isn't here: it has no address that takes a prompt.
export const BUILT_IN_KEYWORDS: readonly Keyword[] = [
  builtIn('claude', 'Claude', 'cl', 'https://claude.ai/new?q=%s', {
    kind: 'ask',
    home: 'https://claude.ai/new',
  }),
  builtIn('chatgpt', 'ChatGPT', 'gpt', 'https://chatgpt.com/?q=%s', {
    kind: 'ask',
    home: 'https://chatgpt.com/',
  }),
  builtIn('perplexity', 'Perplexity', 'pp', 'https://www.perplexity.ai/search?q=%s', {
    kind: 'ask',
    home: 'https://www.perplexity.ai/',
  }),
  builtIn('youtube', 'YouTube', 'yt', 'https://www.youtube.com/results?search_query=%s'),
  builtIn('github', 'GitHub', 'gh', 'https://github.com/search?q=%s'),
  builtIn('wikipedia', 'Wikipedia', 'wiki', 'https://en.wikipedia.org/w/index.php?search=%s'),
  builtIn('mdn', 'MDN', 'mdn', 'https://developer.mozilla.org/search?q=%s'),
  builtIn('npm', 'npm', 'npm', 'https://www.npmjs.com/search?q=%s'),
  builtIn('stackoverflow', 'Stack Overflow', 'stack', 'https://stackoverflow.com/search?q=%s'),
  builtIn('maps', 'Google Maps', 'maps', 'https://www.google.com/maps/search/%s', {
    home: 'https://www.google.com/maps',
  }),
  builtIn('reddit', 'Reddit', 'rd', 'https://www.reddit.com/search/?q=%s'),
  // Off by default: which site is right depends on the country.
  builtIn('translate', 'Google Translate', 'tr', 'https://translate.google.com/?sl=auto&text=%s', {
    enabled: false,
  }),
  builtIn('amazon', 'Amazon', 'amz', 'https://www.amazon.com/s?k=%s', { enabled: false }),
]

/** A built-in by id. @throws If there's no such built-in, which is a bug. */
export function builtInKeyword(id: string): Keyword {
  const keyword = BUILT_IN_KEYWORDS.find((k) => k.id === id)
  if (!keyword) throw new Error(`no built-in keyword "${id}"`)
  return keyword
}

export const MAX_CUSTOM_KEYWORDS = 30

const Name = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(40))
const Word = v.pipe(
  v.string(),
  v.trim(),
  v.toLowerCase(),
  v.check((value) => isValidKeyword(value)),
)
const Url = v.pipe(
  v.string(),
  v.trim(),
  v.check((value) => isValidTemplate(value)),
)

const CustomSchema = v.object({
  id: v.pipe(v.string(), v.regex(/^custom-[a-z0-9-]{1,40}$/)),
  name: Name,
  keyword: Word,
  url: Url,
  enabled: v.boolean(),
})

export type CustomKeyword = v.InferOutput<typeof CustomSchema>

/** What's stored: only changes to the built-ins, so new ones still reach everyone. */
export interface StoredKeywords {
  builtIn: Record<string, Partial<Pick<Keyword, 'name' | 'keyword' | 'url' | 'enabled'>>>
  custom: CustomKeyword[]
}

export const EMPTY_STORED_KEYWORDS: StoredKeywords = { builtIn: {}, custom: [] }

export function isValidKeyword(text: string): boolean {
  return /^[\p{L}\p{N}._-]{1,24}$/u.test(text)
}

/** Only web addresses, so a keyword can never run script. */
export function isValidTemplate(url: string): boolean {
  if (url.length > 512 || !url.includes(PLACEHOLDER)) return false
  try {
    const parsed = new URL(url.replaceAll(PLACEHOLDER, 'x'))
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

const field = <T>(schema: v.GenericSchema<unknown, T>, value: unknown): T | undefined => {
  const result = v.safeParse(schema, value)
  return result.success ? result.output : undefined
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * The keywords in effect: built-ins with their stored changes, then the
 * user's own. Storage syncs from other devices and versions, so anything
 * invalid is dropped field by field, and a keyword already taken by an
 * earlier entry is ignored rather than shadowing it.
 */
export function resolveKeywords(stored: unknown): Keyword[] {
  const raw = isRecord(stored) ? stored : {}
  const changes = isRecord(raw.builtIn) ? raw.builtIn : {}
  const taken = new Set<string>()
  const out: Keyword[] = []
  const add = (keyword: Keyword) => {
    if (taken.has(keyword.keyword)) return
    taken.add(keyword.keyword)
    out.push(keyword)
  }

  for (const base of BUILT_IN_KEYWORDS) {
    const change = changes[base.id]
    const c = isRecord(change) ? change : {}
    add({
      ...base,
      name: field(Name, c.name) ?? base.name,
      keyword: field(Word, c.keyword) ?? base.keyword,
      url: field(Url, c.url) ?? base.url,
      enabled: typeof c.enabled === 'boolean' ? c.enabled : base.enabled,
    })
  }

  const custom = Array.isArray(raw.custom) ? raw.custom.slice(0, MAX_CUSTOM_KEYWORDS) : []
  const ids = new Set<string>()
  for (const entry of custom) {
    const parsed = field(CustomSchema, entry)
    if (!parsed || ids.has(parsed.id)) continue
    ids.add(parsed.id)
    add({ ...parsed, kind: 'search', builtIn: false })
  }
  return out
}

/** The enabled keyword `text` names, with or without the "@". */
export function findKeyword(keywords: readonly Keyword[], text: string): Keyword | undefined {
  const word = (text.startsWith(KEYWORD_PREFIX) ? text.slice(1) : text).toLowerCase()
  if (word === '') return undefined
  return keywords.find((k) => k.enabled && k.keyword === word)
}

/** Where a keyword sends `text`; with nothing typed, the site itself. */
export function keywordUrl(keyword: Keyword, text: string): string {
  const query = text.trim()
  if (query === '') return keyword.home ?? new URL(keyword.url.replaceAll(PLACEHOLDER, '')).origin
  return keyword.url.replaceAll(PLACEHOLDER, encodeURIComponent(query))
}

/** The site a keyword searches, to find its pages in history. */
export function keywordHost(keyword: Keyword): string {
  return new URL(keyword.url.replaceAll(PLACEHOLDER, '')).hostname.replace(/^www\./, '')
}
