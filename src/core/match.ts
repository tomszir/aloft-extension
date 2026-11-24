import { bareUrl } from './url'

/** A `[start, end)` span of a title that matched what was typed. */
export type Highlight = readonly [start: number, end: number]

interface TermMatch {
  score: number
  /** Where the term matched the title; empty when only the URL matched. */
  ranges: Highlight[]
}

const NO_MATCH: TermMatch = { score: 0, ranges: [] }

// Below a mid-word match: a guess at a typo never outranks what was really typed.
const TYPO_SCORE = 0.5
const INITIALS_SCORE = 3
// Short terms are too easy to "correct" into unrelated words.
const MIN_TYPO_TERM = 4

const isWordStart = (text: string, index: number) =>
  index === 0 || !/[\p{L}\p{N}]/u.test(text.charAt(index - 1))

interface Word {
  start: number
  text: string
}

// Every keystroke matches the same titles again, and splitting them into
// words is most of the cost of the initials and typo fallbacks.
const MAX_CACHED_WORDS = 50_000
const wordCache = new Map<string, Word[]>()

function wordsOf(text: string): Word[] {
  const cached = wordCache.get(text)
  if (cached) return cached
  const words = [...text.matchAll(/[\p{L}\p{N}]+/gu)].map((m) => ({ start: m.index, text: m[0] }))
  if (wordCache.size >= MAX_CACHED_WORDS) wordCache.clear()
  wordCache.set(text, words)
  return words
}

function substringMatch(term: string, title: string): TermMatch {
  let score = 0
  let found = -1
  let index = title.indexOf(term)
  while (index !== -1) {
    const here = isWordStart(title, index) ? (index === 0 ? 4 : 3) : 1
    if (here > score) {
      score = here
      found = index
    }
    if (score >= 3) break
    index = title.indexOf(term, index + 1)
  }
  return found === -1 ? NO_MATCH : { score, ranges: [[found, found + term.length]] }
}

/** "wr" for "Window Rules": the term spells the first letters of consecutive words. */
function initialsMatch(term: string, words: readonly Word[]): TermMatch {
  if (term.length < 2 || term.length > words.length) return NO_MATCH
  for (let first = 0; first + term.length <= words.length; first++) {
    const run = words.slice(first, first + term.length)
    if (run.every((word, i) => word.text.startsWith(term.charAt(i)))) {
      return {
        score: INITIALS_SCORE,
        ranges: run.map((word): Highlight => [word.start, word.start + 1]),
      }
    }
  }
  return NO_MATCH
}

/**
 * Optimal string alignment distance (Levenshtein plus swapping two neighbors),
 * or `limit + 1` once it's clearly over `limit`.
 */
export function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1
  let before: number[] = []
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1
      let best = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      )
      if (
        i > 1 &&
        j > 1 &&
        a.charAt(i - 1) === b.charAt(j - 2) &&
        a.charAt(i - 2) === b.charAt(j - 1)
      ) {
        best = Math.min(best, (before[j - 2] ?? 0) + 1)
      }
      current.push(best)
      rowMin = Math.min(rowMin, best)
    }
    if (rowMin > limit) return limit + 1
    before = previous
    previous = current
  }
  return previous[b.length] ?? limit + 1
}

/**
 * Whether `a` and `b` differ by at most one insertion, deletion, substitution
 * or swap of neighbors: `editDistance(a, b, 1) <= 1` without the table, which
 * matters as nearly every typed term only allows one.
 */
export function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  while (i < a.length && i < b.length && a.charCodeAt(i) === b.charCodeAt(i)) i++
  if (i === a.length && i === b.length) return true
  const rest = (from: number, to: number) => a.slice(from) === b.slice(to)
  if (a.length === b.length) {
    return (
      rest(i + 1, i + 1) ||
      (a.charAt(i) === b.charAt(i + 1) && a.charAt(i + 1) === b.charAt(i) && rest(i + 2, i + 2))
    )
  }
  return a.length > b.length ? rest(i + 1, i) : rest(i, i + 1)
}

/**
 * The length of the start of `word` that `term` is a typo of, or 0. Terms are
 * usually typed only part way, so the word is cut to the term's length, give
 * or take the letters a typo adds or drops.
 */
function typoPrefix(term: string, word: string): number {
  // Typos rarely hit the first letter; requiring it (or a swap of the first
  // two) keeps "mail" from matching "sail".
  const sameStart =
    word.charAt(0) === term.charAt(0) ||
    (word.charAt(0) === term.charAt(1) && word.charAt(1) === term.charAt(0))
  if (!sameStart || word.length < MIN_TYPO_TERM - 1) return 0
  const limit = term.length >= 8 ? 2 : 1
  for (let extra = 0; extra <= limit; extra++) {
    for (const length of extra === 0 ? [term.length] : [term.length - extra, term.length + extra]) {
      if (length < 1 || length > word.length) continue
      const start = word.slice(0, length)
      if (limit === 1 ? withinOneEdit(term, start) : editDistance(term, start, limit) <= limit) {
        return length
      }
    }
  }
  return 0
}

function typoMatch(term: string, words: readonly Word[]): TermMatch {
  if (term.length < MIN_TYPO_TERM) return NO_MATCH
  for (const word of words) {
    const length = typoPrefix(term, word.text)
    if (length > 0) return { score: TYPO_SCORE, ranges: [[word.start, word.start + length]] }
  }
  return NO_MATCH
}

/** `title` is lowercased, `shortUrl` lowercased and bare (`bareUrl`). */
function matchTerm(term: string, title: string, shortUrl: string): TermMatch {
  const exact = substringMatch(term, title)
  const urlScore = shortUrl.startsWith(term) ? 4 : shortUrl.includes(term) ? 1 : 0
  if (exact.score > 0 || urlScore > 0) {
    return urlScore > exact.score ? { score: urlScore, ranges: exact.ranges } : exact
  }
  const titleWords = wordsOf(title)
  const initials = initialsMatch(term, titleWords)
  if (initials.score > 0) return initials
  const typo = typoMatch(term, titleWords)
  if (typo.score > 0) return typo
  // "githbu" should still find a page on github.com whatever its title.
  return typoMatch(term, wordsOf(shortUrl)).score > 0 ? { score: TYPO_SCORE, ranges: [] } : NO_MATCH
}

/** How well every term matches, or null when one of them doesn't match at all. */
export function matchScore(terms: readonly string[], title: string, url: string): number | null {
  const lowerTitle = title.toLowerCase()
  const shortUrl = bareUrl(url.toLowerCase())
  let total = 0
  for (const term of terms) {
    const { score } = matchTerm(term, lowerTitle, shortUrl)
    if (score === 0) return null
    total += score
  }
  return total
}

/**
 * Where each term matched the title, preferring the occurrence `matchScore`
 * counted: the start of the title, then the start of a word, then anywhere,
 * then initials, then a likely typo.
 */
export function highlightRanges(terms: readonly string[], title: string): Highlight[] {
  const lower = title.toLowerCase()
  // A few characters change length when lowercased ("İ"), which would shift
  // every index after them; leaving the title plain is better than marking the
  // wrong letters.
  if (lower.length !== title.length) return []
  const ranges: [number, number][] = []
  for (const term of terms) {
    if (term === '') continue
    for (const [start, end] of matchTerm(term, lower, '').ranges) ranges.push([start, end])
  }
  ranges.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const range of ranges) {
    const last = merged.at(-1)
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1])
    else merged.push(range)
  }
  return merged
}
