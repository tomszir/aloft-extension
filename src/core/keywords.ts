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

/**
 * The enabled keywords that `text` (typed after "@") could mean: an exact
 * keyword first, then keywords it starts, then names with a word it starts, so
 * "@you" finds YouTube without knowing it's "yt". Nothing typed lists them all.
 */
export function listKeywords(keywords: readonly Keyword[], text: string): Keyword[] {
  const word = text.toLowerCase()
  const enabled = keywords.filter((k) => k.enabled)
  if (word === '') return enabled
  const rank = (k: Keyword) => {
    if (k.keyword === word) return 0
    if (k.keyword.startsWith(word)) return 1
    return k.name
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .some((w) => w.startsWith(word))
      ? 2
      : 3
  }
  // Stable sort: equally good matches keep the settings order.
  return enabled
    .map((k) => ({ k, rank: rank(k) }))
    .filter(({ rank }) => rank < 3)
    .sort((a, b) => a.rank - b.rank)
    .map(({ k }) => k)
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

/** The stored form of `keywords`: built-ins only where they differ from their defaults. */
export function toStored(keywords: readonly Keyword[]): StoredKeywords {
  const stored: StoredKeywords = { builtIn: {}, custom: [] }
  for (const keyword of keywords) {
    if (!keyword.builtIn) {
      const { id, name, url, enabled } = keyword
      stored.custom.push({ id, name, keyword: keyword.keyword, url, enabled })
      continue
    }
    const base = BUILT_IN_KEYWORDS.find((k) => k.id === keyword.id)
    if (!base) continue
    const change: StoredKeywords['builtIn'][string] = {}
    if (keyword.name !== base.name) change.name = keyword.name
    if (keyword.keyword !== base.keyword) change.keyword = keyword.keyword
    if (keyword.url !== base.url) change.url = keyword.url
    if (keyword.enabled !== base.enabled) change.enabled = keyword.enabled
    if (Object.keys(change).length > 0) stored.builtIn[keyword.id] = change
  }
  return stored
}

export interface KeywordDraft {
  name: string
  keyword: string
  url: string
}

export type DraftError = 'name' | 'keyword' | 'keyword-taken' | 'url'

/** What's wrong with a draft, or undefined when it can be saved. `id` is the keyword being edited. */
export function draftError(
  keywords: readonly Keyword[],
  draft: KeywordDraft,
  id?: string,
): DraftError | undefined {
  if (!v.safeParse(Name, draft.name).success) return 'name'
  const word = draft.keyword.trim().toLowerCase()
  if (!isValidKeyword(word)) return 'keyword'
  if (keywords.some((k) => k.id !== id && k.keyword === word)) return 'keyword-taken'
  if (!isValidTemplate(draft.url.trim())) return 'url'
  return undefined
}

/** `keywords` with `draft` saved over keyword `id`, or added as the user's own. */
export function saveDraft(
  keywords: readonly Keyword[],
  draft: KeywordDraft,
  id: string | undefined,
  newId: () => string,
): Keyword[] {
  const fields = {
    name: draft.name.trim(),
    keyword: draft.keyword.trim().toLowerCase(),
    url: draft.url.trim(),
  }
  if (id !== undefined) return keywords.map((k) => (k.id === id ? { ...k, ...fields } : k))
  return [...keywords, { id: newId(), ...fields, kind: 'search', enabled: true, builtIn: false }]
}

/**
 * The built-ins back as they ship, keeping the user's own. One of theirs that
 * now clashes with a built-in's keyword is switched off rather than lost.
 */
export function resetBuiltIns(keywords: readonly Keyword[]): Keyword[] {
  const taken = new Set(BUILT_IN_KEYWORDS.map((k) => k.keyword))
  const own = keywords
    .filter((k) => !k.builtIn)
    .map((k) =>
      taken.has(k.keyword) ? { ...k, keyword: `${k.keyword.slice(0, 22)}-2`, enabled: false } : k,
    )
  return [...BUILT_IN_KEYWORDS, ...own]
}

/** Whether a built-in differs from how it ships, so resetting would change it. */
export const isChanged = (keyword: Keyword): boolean =>
  keyword.builtIn && toStored([keyword]).builtIn[keyword.id] !== undefined

// chrome.storage.sync allows 8192 bytes per item, counting the key.
const SYNC_ITEM_BYTES = 8192

export function fitsSync(stored: StoredKeywords): boolean {
  const bytes = new TextEncoder().encode(`keywords${JSON.stringify(stored)}`).length
  return bytes <= SYNC_ITEM_BYTES
}
