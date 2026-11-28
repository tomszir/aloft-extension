import * as v from 'valibot'
import { pageKey } from './url'

/**
 * What Aloft remembers about the results people pick: for each text typed,
 * the pages picked for it. It's kept on this device only and fades, so a page
 * stops winning a few weeks after it's no longer picked.
 */
export interface LearnedPick {
  /** What was typed, as `learnedText` writes it. */
  text: string
  url: string
  title: string
  weight: number
  /** When `weight` was last brought up to date. */
  at: number
}

export interface LearnedPicks {
  picks: LearnedPick[]
}

/** A page learned for what's typed now, with how strongly. */
export interface LearnedPage {
  url: string
  title: string
  score: number
}

export const EMPTY_LEARNED: LearnedPicks = { picks: [] }

const DAY = 24 * 60 * 60 * 1000
const HALF_LIFE = 14 * DAY
// Enough for every query a person really repeats; the weakest go first.
const MAX_PICKS = 400
const FORGOTTEN_BELOW = 0.05
/**
 * Two recent picks, and no other page close behind, make a page the top hit.
 * Below 2, as picks start fading the moment they're made.
 */
const PROMOTE_AT = 1.5
const PROMOTE_LEAD = 2
// Picking another page for the same text halves the old one, so a new habit
// takes over after a pick or two instead of waiting for the old one to fade.
const RIVAL_FACTOR = 0.5
const MAX_TEXT = 100
const MAX_TITLE = 300
const MAX_URL = 2048

const PickSchema = v.object({
  text: v.pipe(v.string(), v.minLength(1), v.maxLength(MAX_TEXT)),
  url: v.pipe(v.string(), v.minLength(1), v.maxLength(MAX_URL)),
  title: v.pipe(v.string(), v.maxLength(MAX_TITLE)),
  weight: v.pipe(v.number(), v.finite(), v.minValue(0)),
  at: v.pipe(v.number(), v.finite()),
})

/** Keeps the valid picks of whatever is stored and drops the rest. */
export function normalizeLearned(raw: unknown): LearnedPicks {
  const list = typeof raw === 'object' && raw !== null && 'picks' in raw ? raw.picks : undefined
  if (!Array.isArray(list)) return { picks: [] }
  const picks = list.flatMap((item) => {
    const parsed = v.safeParse(PickSchema, item)
    return parsed.success ? [parsed.output] : []
  })
  return { picks: picks.slice(0, MAX_PICKS) }
}

/** The form typed text is remembered in: lowercase, single spaces. */
export const learnedText = (text: string) =>
  text.toLowerCase().trim().split(/\s+/).join(' ').slice(0, MAX_TEXT)

const weightAt = (pick: LearnedPick, now: number) =>
  pick.weight * 0.5 ** (Math.max(0, now - pick.at) / HALF_LIFE)

export function recordPick(
  learned: LearnedPicks,
  typed: string,
  page: { url: string; title: string },
  now: number,
): LearnedPicks {
  const text = learnedText(typed)
  if (text === '' || page.url.length > MAX_URL) return learned
  const key = pageKey(page.url)
  const title = page.title.slice(0, MAX_TITLE)
  let found = false
  const picks = learned.picks.map((pick): LearnedPick => {
    if (pick.text !== text) return pick
    const weight = weightAt(pick, now)
    if (pageKey(pick.url) !== key) return { ...pick, weight: weight * RIVAL_FACTOR, at: now }
    found = true
    return { text, url: page.url, title, weight: weight + 1, at: now }
  })
  if (!found) picks.push({ text, url: page.url, title, weight: 1, at: now })
  return {
    picks: picks
      .map((pick) => ({ pick, weight: weightAt(pick, now) }))
      .filter(({ weight }) => weight >= FORGOTTEN_BELOW)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, MAX_PICKS)
      .map(({ pick }) => pick),
  }
}

/** Forgets every pick of `url`, so a page removed from history stops being suggested. */
export function forgetPage(learned: LearnedPicks, url: string): LearnedPicks {
  const key = pageKey(url)
  const picks = learned.picks.filter((pick) => pageKey(pick.url) !== key)
  return picks.length === learned.picks.length ? learned : { picks }
}

/**
 * The pages learned for `typed`, strongest first. A pick made for longer text
 * counts too, in proportion to how much of it is typed, so "gi" already leans
 * towards what "github" was picked for.
 */
export function learnedPages(learned: LearnedPicks, typed: string, now: number): LearnedPage[] {
  const text = learnedText(typed)
  if (text === '') return []
  const byPage = new Map<string, LearnedPage & { at: number }>()
  for (const pick of learned.picks) {
    if (!pick.text.startsWith(text)) continue
    const score = weightAt(pick, now) * (text.length / pick.text.length)
    const key = pageKey(pick.url)
    const existing = byPage.get(key)
    if (!existing) {
      byPage.set(key, { url: pick.url, title: pick.title, score, at: pick.at })
      continue
    }
    existing.score += score
    if (pick.at > existing.at)
      Object.assign(existing, { url: pick.url, title: pick.title, at: pick.at })
  }
  return [...byPage.values()]
    .sort((a, b) => b.score - a.score)
    .map(({ url, title, score }) => ({ url, title, score }))
}

/** The page to put above everything else, when one clearly leads. */
export function promotedPage(pages: readonly LearnedPage[]): LearnedPage | undefined {
  const [first, second] = pages
  if (!first || first.score < PROMOTE_AT) return undefined
  if (second && first.score < second.score * PROMOTE_LEAD) return undefined
  return first
}
