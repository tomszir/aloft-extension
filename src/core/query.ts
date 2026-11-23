export type ParsedQuery =
  | { kind: 'empty' }
  | { kind: 'actions'; text: string }
  | { kind: 'text'; text: string; terms: string[]; url: string | null }

export function parseQuery(input: string): ParsedQuery {
  const text = input.trim()
  if (text === '') return { kind: 'empty' }
  if (text.startsWith('>')) return { kind: 'actions', text: text.slice(1).trim() }
  return { kind: 'text', text, terms: text.toLowerCase().split(/\s+/), url: toUrl(text) }
}

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
