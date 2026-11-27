import { describe, expect, it } from 'vitest'
import { compareVersions, parseChangelog, releasesBetween, worthTelling } from './changelog'

const CHANGELOG = `# What's new in Aloft

<!-- A note for whoever edits this.
## 9.9.9 — not a release -->

## 0.2.0 — 25 November 2026

Settings arrive.

- A settings page, with a live preview
  of Aloft as you change things.
- Bold matches.

## 0.1.0 — 24 November 2026

- First version.
`

describe('parseChangelog', () => {
  it('reads each release, newest first, joining wrapped lines', () => {
    expect(parseChangelog(CHANGELOG)).toEqual([
      {
        version: '0.2.0',
        date: '25 November 2026',
        intro: ['Settings arrive.'],
        notes: [
          'A settings page, with a live preview of Aloft as you change things.',
          'Bold matches.',
        ],
      },
      { version: '0.1.0', date: '24 November 2026', intro: [], notes: ['First version.'] },
    ])
  })

  it('ignores anything before the first release', () => {
    expect(parseChangelog('# Title\n\n- not a note\n')).toEqual([])
  })
})

describe('compareVersions', () => {
  it('compares each part as a number', () => {
    expect(compareVersions('0.10.0', '0.9.1')).toBeGreaterThan(0)
    expect(compareVersions('0.4.1', '0.5.0')).toBeLessThan(0)
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0)
  })
})

describe('releasesBetween', () => {
  it('lists what an update brought, skipping the version updated from', () => {
    const releases = parseChangelog(CHANGELOG)
    expect(releasesBetween(releases, '0.1.0', '0.2.0').map((r) => r.version)).toEqual(['0.2.0'])
    expect(releasesBetween(releases, '0.0.9', '0.2.0').map((r) => r.version)).toEqual([
      '0.2.0',
      '0.1.0',
    ])
    expect(releasesBetween(releases, '0.2.0', '0.2.0')).toEqual([])
  })
})

describe('worthTelling', () => {
  it('skips releases that only made small fixes', () => {
    const releases = parseChangelog(
      `## 0.3.0 — 26 November 2026\n\n- Small fixes and improvements.\n\n${CHANGELOG}`,
    )
    expect(worthTelling(releases, '0.2.0', '0.3.0')).toEqual([])
    expect(worthTelling(releases, '0.1.0', '0.3.0').map((r) => r.version)).toEqual(['0.2.0'])
  })
})
