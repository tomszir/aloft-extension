import { findKeyword, type Keyword } from './keywords'

export type ParsedQuery =
  | { kind: 'empty' }
  | { kind: 'actions'; text: string }
  | { kind: 'keyword'; keyword: Keyword; text: string; terms: string[] }
  | { kind: 'text'; text: string; terms: string[]; url: string | null }

/** What the input is scoped to, shown as a chip in front of it. */
export type Chip = 'actions' | Keyword

export interface QueryState {
  chip: Chip | null
  text: string
}

export const EMPTY_QUERY: QueryState = { chip: null, text: '' }

const ACTIONS_PREFIX = '>'

const chipText = (chip: Chip) => (chip === 'actions' ? ACTIONS_PREFIX : chip.keyword)

/**
 * The state after the input's text changes to `input`. A keyword makes a chip
 * only when Space is typed right after it, so text given back by leaveChip,
 * or pasted, stays plain text however it continues.
 */
export function applyInput(
  state: QueryState,
  input: string,
  keywords: readonly Keyword[] = [],
): QueryState {
  if (state.chip === null) {
    const typed = input.trimStart()
    if (typed.startsWith(ACTIONS_PREFIX)) {
      return { chip: 'actions', text: typed.slice(ACTIONS_PREFIX.length).trimStart() }
    }
    const word = /^(\S+) $/.exec(typed)?.[1]
    const keyword = word === undefined ? undefined : findKeyword(keywords, word)
    if (keyword) return enterKeyword(keyword)
  }
  return { chip: state.chip, text: input }
}

export const enterKeyword = (keyword: Keyword): QueryState => ({ chip: keyword, text: '' })

/** The keyword the input names exactly, offered as a chip before Space or Tab makes it one. */
export function offeredKeyword(
  state: QueryState,
  keywords: readonly Keyword[],
): Keyword | undefined {
  return state.chip === null ? findKeyword(keywords, state.text.trim()) : undefined
}

/**
 * Backspace on an empty input or Esc: the chip turns back into the text that
 * made it, so leaving loses nothing that was typed.
 */
export function leaveChip(state: QueryState): QueryState {
  if (state.chip === null) return state
  const text = state.text.trim()
  return { chip: null, text: chipText(state.chip) + (text === '' ? '' : ` ${text}`) }
}

// Only the chip enters actions mode: a ">" left in the input after leaving it
// is searched for like any other text.
export function parseQuery(input: string, chip: Chip | null = null): ParsedQuery {
  const text = input.trim()
  if (chip === 'actions') return { kind: 'actions', text }
  if (chip !== null) return { kind: 'keyword', keyword: chip, text, terms: termsOf(text) }
  if (text === '') return { kind: 'empty' }
  return { kind: 'text', text, terms: termsOf(text), url: toUrl(text) }
}

const termsOf = (text: string) => text.toLowerCase().split(/\s+/).filter(Boolean)

// Anything else with a scheme, notably javascript: and data:, is searched for
// instead of opened, so typed text can never run script.
const OPENABLE_SCHEMES = new Set([
  'http:',
  'https:',
  'ftp:',
  'file:',
  'chrome:',
  'helium:',
  'about:',
  'view-source:',
])

// Without the browser's public suffix list, "notes.md" would look like a
// domain. Common file extensions only count as a TLD when a port or path makes
// the intent clear ("deno.land/x" vs "deno.ts").
const FILE_EXTENSIONS = new Set([
  'c',
  'cpp',
  'css',
  'csv',
  'go',
  'h',
  'html',
  'java',
  'js',
  'json',
  'jsx',
  'lock',
  'log',
  'md',
  'php',
  'py',
  'rb',
  'rs',
  'sh',
  'toml',
  'ts',
  'tsx',
  'txt',
  'yaml',
  'yml',
])

const LOCAL_HOST = /^(localhost|\d{1,3}(\.\d{1,3}){3})$/
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

/** The address to open for `text`, or null if it should be searched for. */
export function toUrl(text: string): string | null {
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(text)?.[1]
  if (scheme) {
    if (OPENABLE_SCHEMES.has(`${scheme.toLowerCase()}:`)) return parse(text)
    // "localhost:3000" and "example.com:8080" parse as a scheme too.
    if (!/^[a-z][a-z0-9+.-]*:\d/i.test(text)) return null
  }
  // Without a scheme, spaces mean the user is typing words, not an address.
  if (/\s/.test(text)) return null

  const match = /^([^/?#:]+)(:\d{1,5})?([/?#].*)?$/.exec(text)
  const host = match?.[1]?.toLowerCase()
  if (!match || !host) return null

  if (LOCAL_HOST.test(host)) return parse(`http://${text}`)

  const labels = host.split('.')
  const tld = labels.at(-1) ?? ''
  if (labels.length < 2 || !labels.every((l) => LABEL.test(l))) return null
  if (!/^[a-z]{2,24}$/.test(tld)) return null
  if (FILE_EXTENSIONS.has(tld) && !match[2] && !match[3]) return null
  return parse(`https://${text}`)
}

function parse(candidate: string): string | null {
  try {
    return new URL(candidate).href
  } catch {
    return null
  }
}
