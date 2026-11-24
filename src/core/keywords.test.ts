import { describe, expect, it } from 'vitest'
import {
  BUILT_IN_KEYWORDS,
  builtInKeyword,
  draftError,
  findKeyword,
  fitsSync,
  isChanged,
  isValidTemplate,
  keywordHost,
  keywordUrl,
  MAX_CUSTOM_KEYWORDS,
  resetBuiltIns,
  resolveKeywords,
  saveDraft,
  toStored,
} from './keywords'

const custom = (n: number, keyword = `k${n}`) => ({
  id: `custom-${n}`,
  name: `Site ${n}`,
  keyword,
  url: `https://site${n}.test/?q=%s`,
  enabled: true,
})

describe('resolveKeywords', () => {
  it('is the built-ins when nothing is stored', () => {
    expect(resolveKeywords(undefined)).toEqual(BUILT_IN_KEYWORDS)
    expect(resolveKeywords('garbage')).toEqual(BUILT_IN_KEYWORDS)
  })

  it('applies stored changes to built-ins, field by field', () => {
    const keywords = resolveKeywords({
      builtIn: { youtube: { keyword: 'YT2', enabled: false, url: 'javascript:%s' } },
    })
    const youtube = keywords.find((k) => k.id === 'youtube')
    expect(youtube).toMatchObject({ keyword: 'yt2', enabled: false, name: 'YouTube' })
    expect(youtube?.url).toBe('https://www.youtube.com/results?search_query=%s')
  })

  it('adds valid custom keywords and drops broken ones', () => {
    const keywords = resolveKeywords({
      custom: [custom(1), { ...custom(2), url: 'data:text/html,%s' }, { id: 'x' }],
    })
    expect(keywords.filter((k) => !k.builtIn).map((k) => k.id)).toEqual(['custom-1'])
  })

  it('ignores a keyword already taken by an earlier entry', () => {
    const keywords = resolveKeywords({
      custom: [custom(1, 'yt'), custom(2, 'mine'), custom(3, 'mine')],
    })
    expect(keywords.filter((k) => k.keyword === 'yt')).toHaveLength(1)
    expect(keywords.filter((k) => !k.builtIn).map((k) => k.id)).toEqual(['custom-2'])
  })

  it('keeps at most MAX_CUSTOM_KEYWORDS of the user’s own', () => {
    const many = Array.from({ length: MAX_CUSTOM_KEYWORDS + 5 }, (_, i) => custom(i))
    expect(resolveKeywords({ custom: many }).filter((k) => !k.builtIn)).toHaveLength(
      MAX_CUSTOM_KEYWORDS,
    )
  })
})

describe('findKeyword', () => {
  const keywords = resolveKeywords({ builtIn: { reddit: { enabled: false } } })

  it('matches with or without the @, ignoring case', () => {
    expect(findKeyword(keywords, 'yt')?.id).toBe('youtube')
    expect(findKeyword(keywords, '@YT')?.id).toBe('youtube')
  })

  it('skips switched-off keywords and unknown words', () => {
    expect(findKeyword(keywords, 'rd')).toBeUndefined()
    expect(findKeyword(keywords, 'nope')).toBeUndefined()
    expect(findKeyword(keywords, '@')).toBeUndefined()
  })
})

describe('keywordUrl', () => {
  const [claude] = BUILT_IN_KEYWORDS
  const github = BUILT_IN_KEYWORDS.find((k) => k.id === 'github')

  it('puts the encoded text where %s is', () => {
    expect(github && keywordUrl(github, ' a&b c ')).toBe('https://github.com/search?q=a%26b%20c')
  })

  it('opens the site itself when nothing is typed', () => {
    expect(claude && keywordUrl(claude, '')).toBe('https://claude.ai/new')
    expect(github && keywordUrl(github, '  ')).toBe('https://github.com')
  })

  it('knows each site’s host', () => {
    expect(github && keywordHost(github)).toBe('github.com')
    const youtube = BUILT_IN_KEYWORDS.find((k) => k.id === 'youtube')
    expect(youtube && keywordHost(youtube)).toBe('youtube.com')
  })
})

describe('isValidTemplate', () => {
  it.each([
    ['https://example.com/?q=%s', true],
    ['http://intranet.test/search/%s', true],
    ['https://example.com/', false],
    ['javascript:alert(%s)', false],
    ['not a url %s', false],
  ])('%s → %s', (url, valid) => {
    expect(isValidTemplate(url)).toBe(valid)
  })

  it('accepts every built-in', () => {
    for (const k of BUILT_IN_KEYWORDS) expect(isValidTemplate(k.url)).toBe(true)
  })
})

describe('editing', () => {
  const keywords = resolveKeywords(undefined)
  const draft = { name: 'My wiki', keyword: 'MW', url: 'https://wiki.test/?q=%s' }
  const newId = () => 'custom-1'

  it('stores only what differs from the built-ins', () => {
    expect(toStored(keywords)).toEqual({ builtIn: {}, custom: [] })
    const off = keywords.map((k) => (k.id === 'reddit' ? { ...k, enabled: false } : k))
    expect(toStored(off)).toEqual({ builtIn: { reddit: { enabled: false } }, custom: [] })
  })

  it('adds a keyword of the user’s own and round-trips it through storage', () => {
    const added = saveDraft(keywords, draft, undefined, newId)
    const mine = added.at(-1)
    expect(mine).toMatchObject({ id: 'custom-1', keyword: 'mw', builtIn: false, enabled: true })
    expect(resolveKeywords(toStored(added))).toEqual(added)
  })

  it('edits a built-in in place, storing the change', () => {
    const edited = saveDraft(
      keywords,
      { ...draft, name: 'YouTube', url: builtInKeyword('youtube').url },
      'youtube',
      newId,
    )
    expect(toStored(edited).builtIn).toEqual({ youtube: { keyword: 'mw' } })
  })

  it('explains what stops a draft being saved', () => {
    expect(draftError(keywords, draft)).toBeUndefined()
    expect(draftError(keywords, { ...draft, name: ' ' })).toBe('name')
    expect(draftError(keywords, { ...draft, keyword: 'two words' })).toBe('keyword')
    expect(draftError(keywords, { ...draft, keyword: 'yt' })).toBe('keyword-taken')
    expect(draftError(keywords, { ...draft, keyword: 'yt' }, 'youtube')).toBeUndefined()
    expect(draftError(keywords, { ...draft, url: 'https://wiki.test/' })).toBe('url')
  })

  it('resets the built-ins, keeping the user’s own and switching off a clash', () => {
    const changed = saveDraft(
      saveDraft(
        keywords,
        { name: 'YouTube', keyword: 'tube', url: builtInKeyword('youtube').url },
        'youtube',
        newId,
      ),
      { ...draft, keyword: 'yt' },
      undefined,
      newId,
    )
    expect(changed.some(isChanged)).toBe(true)
    const reset = resetBuiltIns(changed)
    expect(reset.filter((k) => k.builtIn)).toEqual(BUILT_IN_KEYWORDS)
    expect(reset.at(-1)).toMatchObject({ id: 'custom-1', keyword: 'yt-2', enabled: false })
    expect(reset.some(isChanged)).toBe(false)
  })

  it('knows when the keywords outgrow one sync item', () => {
    expect(fitsSync(toStored(keywords))).toBe(true)
    const long = { name: 'x'.repeat(40), keyword: 'k', url: `https://e.test/${'p'.repeat(480)}%s` }
    const many = Array.from({ length: 20 }, (_, i) => ({ ...long, keyword: `k${i}` }))
    const stored = many.reduce(
      (all, d, i) => saveDraft(all, d, undefined, () => `custom-${i}`),
      keywords,
    )
    expect(fitsSync(toStored(stored))).toBe(false)
  })
})
