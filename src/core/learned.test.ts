import { describe, expect, it } from 'vitest'
import {
  EMPTY_LEARNED,
  type LearnedPicks,
  learnedPages,
  learnedText,
  normalizeLearned,
  promotedPage,
  recordPick,
} from './learned'

const NOW = Date.UTC(2026, 10, 24)
const DAY = 24 * 60 * 60 * 1000

const GITHUB = { url: 'https://github.com/tomszir/aloft', title: 'tomszir/aloft' }
const WIKI = { url: 'https://wiki.hypr.land/', title: 'Hyprland wiki' }

function picked(times: number, text: string, page = GITHUB, at = NOW): LearnedPicks {
  let learned = EMPTY_LEARNED
  for (let i = 0; i < times; i++) learned = recordPick(learned, text, page, at)
  return learned
}

const scoreOf = (learned: LearnedPicks, text: string, url: string, now = NOW) =>
  learnedPages(learned, text, now).find((p) => p.url === url)?.score ?? 0

describe('learnedText', () => {
  it('ignores case and extra spaces', () => {
    expect(learnedText('  Window   Rules ')).toBe('window rules')
  })
})

describe('recordPick', () => {
  it('adds up picks of the same page for the same text', () => {
    expect(scoreOf(picked(3, 'gh'), 'gh', GITHUB.url)).toBeCloseTo(3)
  })

  it('treats a fragment or trailing slash as the same page', () => {
    let learned = picked(1, 'gh')
    learned = recordPick(learned, 'gh', { ...GITHUB, url: `${GITHUB.url}/#readme` }, NOW)
    expect(learnedPages(learned, 'gh', NOW)).toHaveLength(1)
  })

  it('halves the other pages picked for the same text', () => {
    const learned = recordPick(picked(4, 'gh'), 'gh', WIKI, NOW)
    expect(scoreOf(learned, 'gh', GITHUB.url)).toBeCloseTo(2)
    expect(scoreOf(learned, 'gh', WIKI.url)).toBeCloseTo(1)
  })

  it('ignores empty text', () => {
    expect(recordPick(EMPTY_LEARNED, '  ', GITHUB, NOW)).toBe(EMPTY_LEARNED)
  })

  it('forgets picks once they have faded away', () => {
    const old = picked(1, 'gh', GITHUB, NOW - 200 * DAY)
    expect(recordPick(old, 'wiki', WIKI, NOW).picks.map((p) => p.text)).toEqual(['wiki'])
  })

  it('keeps the store bounded, dropping the weakest', () => {
    let learned = picked(5, 'keep')
    for (let i = 0; i < 500; i++) {
      learned = recordPick(learned, `text ${i}`, { url: `https://x.test/${i}`, title: '' }, NOW)
    }
    expect(learned.picks.length).toBe(400)
    expect(learned.picks[0]?.text).toBe('keep')
  })
})

describe('learnedPages', () => {
  it('fades by half every two weeks', () => {
    const learned = picked(4, 'gh', GITHUB, NOW - 14 * DAY)
    expect(scoreOf(learned, 'gh', GITHUB.url)).toBeCloseTo(2)
  })

  it('counts picks made for longer text in proportion to what is typed', () => {
    const learned = picked(4, 'github')
    expect(scoreOf(learned, 'gith', GITHUB.url)).toBeCloseTo(4 * (4 / 6))
    expect(scoreOf(learned, 'gx', GITHUB.url)).toBe(0)
  })

  it('lists the strongest page first', () => {
    const learned = recordPick(picked(2, 'w', WIKI), 'wiki', GITHUB, NOW)
    expect(learnedPages(learned, 'w', NOW).map((p) => p.url)).toEqual([WIKI.url, GITHUB.url])
  })
})

describe('promotedPage', () => {
  it('needs two picks before a page takes the top', () => {
    expect(promotedPage(learnedPages(picked(1, 'gh'), 'gh', NOW))).toBeUndefined()
    expect(promotedPage(learnedPages(picked(2, 'gh'), 'gh', NOW))?.url).toBe(GITHUB.url)
  })

  it('counts two picks a moment apart as two', () => {
    let learned = recordPick(EMPTY_LEARNED, 'gh', GITHUB, NOW)
    learned = recordPick(learned, 'gh', GITHUB, NOW + 1000)
    expect(promotedPage(learnedPages(learned, 'gh', NOW + 2000))?.url).toBe(GITHUB.url)
  })

  it('stays out of the way while two pages are close', () => {
    const pages = [
      { ...GITHUB, score: 3 },
      { ...WIKI, score: 2 },
    ]
    expect(promotedPage(pages)).toBeUndefined()
  })

  it('lets a new habit take over after two picks', () => {
    let learned = picked(3, 'gh')
    learned = recordPick(learned, 'gh', WIKI, NOW)
    expect(promotedPage(learnedPages(learned, 'gh', NOW))).toBeUndefined()
    learned = recordPick(learned, 'gh', WIKI, NOW)
    expect(promotedPage(learnedPages(learned, 'gh', NOW))?.url).toBe(WIKI.url)
  })
})

describe('normalizeLearned', () => {
  it('keeps valid picks and drops the rest', () => {
    const good = { text: 'gh', url: GITHUB.url, title: 'x', weight: 1, at: NOW }
    const raw = { picks: [good, { ...good, weight: -1 }, { text: 1 }, null, { ...good, text: '' }] }
    expect(normalizeLearned(raw)).toEqual({ picks: [good] })
  })

  it('starts empty from anything else', () => {
    expect(normalizeLearned(undefined)).toEqual(EMPTY_LEARNED)
    expect(normalizeLearned({ picks: 'nope' })).toEqual(EMPTY_LEARNED)
  })
})
