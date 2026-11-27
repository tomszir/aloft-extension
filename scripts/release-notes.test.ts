import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseChangelog } from '../src/core/changelog.ts'
import {
  CHANGELOG,
  draftNotes,
  findSection,
  formatDate,
  noteFor,
  overrideSubjects,
  sectionBody,
} from './release-notes.ts'

const NOTES = `# What's new in Aloft

<!-- How to write these. -->

## 0.5.0 — 25 November 2026

- Aloft has a new name in the store.
`
const date = new Date(Date.UTC(2026, 10, 27, 23, 30))

describe('the changelog', () => {
  // A release PR without notes fails CI here, before it can be merged.
  it('has notes for the version in package.json, newest first', () => {
    const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }
    const [newest] = parseChangelog(readFileSync(CHANGELOG, 'utf8'))
    expect(newest?.version).toBe(version)
    expect(newest?.notes.length).toBeGreaterThan(0)
  })
})

describe('noteFor', () => {
  it('turns feat, fix and perf summaries into sentences', () => {
    expect(noteFor('fix(overlay): keep everything typed while aloft opens (#57)')).toBe(
      'Keep everything typed while Aloft opens.',
    )
    expect(noteFor('perf: open faster!')).toBe('Open faster!')
  })

  it('marks breaking changes', () => {
    expect(noteFor('feat(search)!: drop the old keywords')).toBe(
      '**Breaking:** Drop the old keywords.',
    )
  })

  it('leaves out what people would not notice', () => {
    expect(noteFor('ci: stop release runs failing (#56)')).toBeUndefined()
    expect(noteFor('chore(main): release 0.5.1')).toBeUndefined()
    expect(noteFor('docs: draft the release notes')).toBeUndefined()
  })
})

describe('overrideSubjects', () => {
  it('reads the summaries a PR body puts in place of its title', () => {
    const body =
      'What changed.\n\nBEGIN_COMMIT_OVERRIDE\nfix: one\n\nfeat(search): two\nEND_COMMIT_OVERRIDE\n'
    expect(overrideSubjects(body)).toEqual(['fix: one', 'feat(search): two'])
    expect(overrideSubjects('No block here.')).toBeUndefined()
  })
})

describe('formatDate', () => {
  it('uses UTC', () => {
    expect(formatDate(date)).toBe('27 November 2026')
  })
})

describe('draftNotes', () => {
  it('adds a section above the newest release, from the summaries people would notice', () => {
    const drafted = draftNotes({
      notes: NOTES,
      version: '0.5.1',
      date,
      subjects: ['fix(overlay): keep typing (#57)', 'ci: fix the release (#56)'],
    })
    expect(drafted).toBe(`# What's new in Aloft

<!-- How to write these. -->

## 0.5.1 — 27 November 2026

- Keep typing.

## 0.5.0 — 25 November 2026

- Aloft has a new name in the store.
`)
  })

  it('says something even when nothing is worth a line', () => {
    const drafted = draftNotes({ notes: NOTES, version: '0.5.1', date, subjects: ['ci: x'] })
    expect(sectionBody(drafted, '0.5.1')).toBe('- Small fixes and improvements.')
  })

  it('keeps the notes rewritten on the release PR and adds only new commits', () => {
    const previous = draftNotes({
      notes: NOTES,
      version: '0.5.1',
      date,
      subjects: ['fix: a'],
    }).replace('- A.', 'Typing is more reliable.\n\n- Nothing you type is lost.')
    const drafted = draftNotes({
      notes: NOTES,
      previous,
      version: '0.5.1',
      date,
      subjects: ['feat(search): b'],
    })
    expect(sectionBody(drafted, '0.5.1')).toBe(
      'Typing is more reliable.\n\n- Nothing you type is lost.\n- B.',
    )
  })

  it('carries rewritten notes over when the release changes version', () => {
    const previous = draftNotes({
      notes: NOTES,
      version: '0.5.1',
      date,
      subjects: ['fix: a'],
    }).replace('- A.', '- Rewritten by hand.')
    const drafted = draftNotes({
      notes: NOTES,
      previous,
      version: '0.6.0',
      date,
      subjects: ['feat: b'],
      carriedFrom: '0.5.1',
    })
    expect(sectionBody(drafted, '0.6.0')).toBe('- Rewritten by hand.\n- B.')
    expect(findSection(drafted, '0.5.1')).toBeUndefined()
  })

  it('drops the placeholder once there is something to say', () => {
    const previous = draftNotes({ notes: NOTES, version: '0.5.1', date, subjects: [] })
    const drafted = draftNotes({
      notes: NOTES,
      previous,
      version: '0.5.1',
      date,
      subjects: ['fix: a'],
    })
    expect(sectionBody(drafted, '0.5.1')).toBe('- A.')
  })

  it('leaves a changelog that already has the version alone', () => {
    expect(draftNotes({ notes: NOTES, version: '0.5.0', date, subjects: ['fix: a'] })).toBe(NOTES)
  })
})

describe('sectionBody', () => {
  it('gives a release its notes without the heading', () => {
    expect(sectionBody(NOTES, '0.5.0')).toBe('- Aloft has a new name in the store.')
    expect(findSection(NOTES, '0.4.0')).toBeUndefined()
  })
})
