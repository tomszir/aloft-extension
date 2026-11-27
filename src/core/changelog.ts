// CHANGELOG.md holds each release's notes for the people using Aloft, written
// by hand on the release PR (docs/releasing.md). The settings page shows them,
// the background decides from them whether an update is worth a mention, and
// scripts/release-notes.ts drafts and publishes them.

export interface Release {
  version: string
  /** As written in the heading, e.g. "25 November 2026". */
  date: string
  /** Paragraphs before the list, if any. */
  intro: string[]
  /** Every note, in order, whichever group it's in. */
  notes: string[]
  /**
   * The notes as written: a bigger release groups them under `### ` headings.
   * Notes before the first heading, or in a release without any, form a group
   * with no title.
   */
  groups: NoteGroup[]
}

export interface NoteGroup {
  title?: string
  notes: string[]
}

export const RELEASE_HEADING = /^## (\d+\.\d+\.\d+) — (.+)$/
const GROUP_HEADING = /^### (.+)$/

/** What a release with nothing for people to notice says. */
export const NOTHING_TO_SAY = 'Small fixes and improvements.'

/** The releases in CHANGELOG.md, in the file's order: newest first. */
export function parseChangelog(text: string): Release[] {
  const releases: Release[] = []
  let current: Release | undefined
  let last: 'intro' | 'note' | undefined
  for (const raw of text.replace(/<!--[\s\S]*?-->/g, '').split('\n')) {
    const line = raw.trim()
    const heading = RELEASE_HEADING.exec(line)
    if (heading) {
      current = {
        version: heading[1] ?? '',
        date: heading[2] ?? '',
        intro: [],
        notes: [],
        groups: [],
      }
      releases.push(current)
      last = undefined
      continue
    }
    if (!current) continue
    const group = GROUP_HEADING.exec(line)
    if (group) {
      current.groups.push({ title: group[1] ?? '', notes: [] })
      last = undefined
      continue
    }
    if (line.startsWith('#')) continue
    if (line === '') {
      last = undefined
    } else if (line.startsWith('- ')) {
      let into = current.groups.at(-1)
      if (!into) {
        into = { notes: [] }
        current.groups.push(into)
      }
      into.notes.push(line.slice(2).trim())
      last = 'note'
    } else if (last !== undefined) {
      // A wrapped line carries on the note or paragraph above it.
      const list = last === 'note' ? (current.groups.at(-1)?.notes ?? []) : current.intro
      list[list.length - 1] = `${list.at(-1) ?? ''} ${line}`
    } else {
      current.intro.push(line)
      last = 'intro'
    }
  }
  for (const release of releases) {
    release.groups = release.groups.filter((g) => g.notes.length > 0)
    release.notes = release.groups.flatMap((g) => g.notes)
  }
  return releases
}

/** Negative when `a` is the older version, positive when it's newer. */
export function compareVersions(a: string, b: string): number {
  const parts = (version: string) => version.split('.').map((part) => Number.parseInt(part, 10))
  const [x, y] = [parts(a), parts(b)]
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const difference = (x[i] ?? 0) - (y[i] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

/** The releases after `from`, up to and including `to`: what an update brought. */
export function releasesBetween(releases: readonly Release[], from: string, to: string): Release[] {
  return releases.filter(
    (r) => compareVersions(r.version, from) > 0 && compareVersions(r.version, to) <= 0,
  )
}

/** The releases between `from` and `to` that say more than {@link NOTHING_TO_SAY}. */
export function worthTelling(releases: readonly Release[], from: string, to: string): Release[] {
  return releasesBetween(releases, from, to).filter(
    (r) => r.intro.length > 0 || r.notes.some((note) => note !== NOTHING_TO_SAY),
  )
}
