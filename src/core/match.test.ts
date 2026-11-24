import { describe, expect, it } from 'vitest'
import { editDistance, highlightRanges, matchScore, withinOneEdit } from './match'

describe('matchScore', () => {
  it('requires every term', () => {
    expect(matchScore(['window', 'rules'], 'Window rules', 'https://x.test')).not.toBeNull()
    expect(matchScore(['window', 'nope'], 'Window rules', 'https://x.test')).toBeNull()
  })

  it('prefers word starts over mid-word matches', () => {
    const start = matchScore(['rul'], 'Window rules', 'https://x.test') ?? 0
    const middle = matchScore(['ule'], 'Window rules', 'https://x.test') ?? 0
    expect(start).toBeGreaterThan(middle)
  })

  it('matches the start of the URL without scheme or www', () => {
    expect(matchScore(['git'], 'Something else', 'https://www.github.com/')).toBe(4)
  })

  it('matches the initials of consecutive words', () => {
    expect(matchScore(['wr'], 'Window Rules', 'https://x.test')).toBe(3)
    expect(matchScore(['hwr'], 'Hyprland: Window Rules', 'https://x.test')).toBe(3)
    expect(matchScore(['rw'], 'Window Rules', 'https://x.test')).toBeNull()
  })

  it('forgives a typo in longer terms, below any real match', () => {
    const typo = matchScore(['widnow'], 'Window rules', 'https://x.test')
    const swapped = matchScore(['iwndow'], 'Window rules', 'https://x.test')
    const real = matchScore(['ule'], 'Window rules', 'https://x.test') ?? 0
    expect(typo).not.toBeNull()
    expect(swapped).not.toBeNull()
    expect(typo ?? 0).toBeLessThan(real)
  })

  it('forgives a typo in a term typed only part way', () => {
    expect(matchScore(['confgi'], 'Configuring Hyprland', 'https://x.test')).not.toBeNull()
    expect(matchScore(['confiug'], 'Configuring Hyprland', 'https://x.test')).not.toBeNull()
  })

  it('forgives a typo in the address', () => {
    expect(matchScore(['githbu'], 'tomszir/aloft', 'https://github.com/x')).not.toBeNull()
  })

  it('leaves short terms and different first letters alone', () => {
    expect(matchScore(['wnd'], 'Window rules', 'https://x.test')).toBeNull()
    expect(matchScore(['sail'], 'Mail', 'https://x.test')).toBeNull()
    expect(matchScore(['zzzzzz'], 'Window rules', 'https://x.test')).toBeNull()
  })

  it('allows two typos only in long terms', () => {
    expect(matchScore(['hyrplnad'], 'Hyprland wiki', 'https://x.test')).not.toBeNull()
    expect(matchScore(['wnidwo'], 'Window rules', 'https://x.test')).toBeNull()
  })
})

describe('editDistance', () => {
  it('counts insertions, deletions, substitutions and swaps of neighbors', () => {
    expect(editDistance('window', 'window', 2)).toBe(0)
    expect(editDistance('windw', 'window', 2)).toBe(1)
    expect(editDistance('wimdow', 'window', 2)).toBe(1)
    expect(editDistance('widnow', 'window', 2)).toBe(1)
    expect(editDistance('abc', 'xyz', 1)).toBe(2)
  })
})

describe('withinOneEdit', () => {
  it('agrees with editDistance', () => {
    const words = [
      'window',
      'windw',
      'wimdow',
      'widnow',
      'windows',
      'iwndow',
      'wnidow',
      'abc',
      'w',
      '',
    ]
    for (const a of words) {
      for (const b of words) {
        expect(withinOneEdit(a, b), `${a} / ${b}`).toBe(editDistance(a, b, 1) <= 1)
      }
    }
  })
})

describe('highlightRanges', () => {
  it('marks each term where it matched, merging overlaps', () => {
    expect(highlightRanges(['win', 'rul'], 'Window rules')).toEqual([
      [0, 3],
      [7, 10],
    ])
    expect(highlightRanges(['wind', 'ndow'], 'Window rules')).toEqual([[0, 6]])
  })

  it('prefers a word start over an earlier mid-word match', () => {
    expect(highlightRanges(['al'], 'Totally Aloft')).toEqual([[8, 10]])
  })

  it('falls back to a mid-word match, and skips terms only the URL matched', () => {
    expect(highlightRanges(['ule'], 'Window rules')).toEqual([[8, 11]])
    expect(highlightRanges(['github'], 'tomszir/aloft')).toEqual([])
  })

  it('leaves titles plain when lowercasing would shift the indexes', () => {
    expect(highlightRanges(['ist'], 'İstanbul')).toEqual([])
  })

  it('marks the first letter of each word that initials matched', () => {
    expect(highlightRanges(['wr'], 'Window Rules')).toEqual([
      [0, 1],
      [7, 8],
    ])
  })

  it('marks the part of a word a typo matched', () => {
    expect(highlightRanges(['widnow'], 'Window rules')).toEqual([[0, 6]])
    expect(highlightRanges(['confgi'], 'Configuring Hyprland')).toEqual([[0, 6]])
  })
})
