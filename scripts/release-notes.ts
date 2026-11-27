// Drafts and publishes CHANGELOG.md's notes, which are written for the people
// using Aloft (docs/releasing.md).
//
//   node scripts/release-notes.ts draft [<previous head of the release PR's branch>]
//     On the release PR's branch, which the release workflow does: adds a
//     section for package.json's version, made from the feat, fix and perf
//     summaries since the last release, for the maintainer to rewrite before
//     merging. With the branch's previous head, the section written there is
//     kept and only commits since are added, so edits survive release-please
//     rebuilding its branch.
//
//   node scripts/release-notes.ts section <version>
//     Prints that version's notes, which become its GitHub release's text.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { NOTHING_TO_SAY, RELEASE_HEADING } from '../src/core/changelog.ts'

export const CHANGELOG = 'CHANGELOG.md'
const HEADINGS = new RegExp(RELEASE_HEADING.source, 'gm')
const NOTEWORTHY = /^(feat|fix|perf)(\([a-z0-9][a-z0-9-]*\))?(!)?: (.+)$/
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** "27 November 2026", in UTC so the runner's time zone doesn't matter. */
export function formatDate(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}

/** A commit summary as a sentence, or nothing for commits people wouldn't notice. */
export function noteFor(subject: string): string | undefined {
  const match = NOTEWORTHY.exec(subject.trim())
  const summary = match?.[4]?.replace(/\s*\(#\d+\)$/, '').trim()
  if (!summary) return undefined
  const text = summary.replace(/\baloft\b/g, 'Aloft')
  const sentence = `${text[0]?.toUpperCase()}${text.slice(1)}${/[.!?]$/.test(text) ? '' : '.'}`
  // A breaking change makes people redo something, so the draft can't hide it.
  return match?.[3] ? `**Breaking:** ${sentence}` : sentence
}

/** The commit summaries a PR body's BEGIN_COMMIT_OVERRIDE block puts in place of its title. */
export function overrideSubjects(body: string): string[] | undefined {
  const block = /BEGIN_COMMIT_OVERRIDE\s*\n([\s\S]*?)\n\s*END_COMMIT_OVERRIDE/.exec(body)?.[1]
  if (block === undefined) return undefined
  return block
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

interface Section {
  start: number
  end: number
  /** The heading and everything under it, without trailing blank lines. */
  text: string
}

/** Where `version`'s section is in `notes`: its heading up to the next one. */
export function findSection(notes: string, version: string): Section | undefined {
  const headings = [...notes.matchAll(HEADINGS)]
  const index = headings.findIndex((match) => match[1] === version)
  const heading = headings[index]
  if (heading === undefined) return undefined
  const start = heading.index
  const end = headings[index + 1]?.index ?? notes.length
  return { start, end, text: notes.slice(start, end).trimEnd() }
}

/** `version`'s notes without their heading: its GitHub release's text. */
export function sectionBody(notes: string, version: string): string | undefined {
  const section = findSection(notes, version)
  return section?.text.split('\n').slice(1).join('\n').trim()
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const inlineHtml = (text: string) =>
  escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')

/**
 * A section's Markdown as addons.mozilla.org's release notes, which take
 * plain text with a few HTML tags (b, strong, em, code, a, ul, li) and turn
 * every newline into a line break, so each list is kept on one line.
 */
export function amoNotes(markdown: string): string {
  const blocks: string[] = []
  let list: string[] = []
  const endList = () => {
    if (list.length > 0) blocks.push(`<ul>${list.map((item) => `<li>${item}</li>`).join('')}</ul>`)
    list = []
  }
  for (const line of markdown.split('\n')) {
    const item = /^[-*] (.+)$/.exec(line)
    const heading = /^#{3,} (.+)$/.exec(line)
    if (item?.[1] !== undefined) {
      list.push(inlineHtml(item[1]))
      continue
    }
    endList()
    if (heading?.[1] !== undefined) blocks.push(`<b>${inlineHtml(heading[1])}</b>`)
    else if (line.trim() !== '') blocks.push(inlineHtml(line.trim()))
  }
  endList()
  // A blank line before each paragraph and heading; a list follows straight on.
  return blocks
    .map((block, i) => (i === 0 ? block : `${block.startsWith('<ul>') ? '\n' : '\n\n'}${block}`))
    .join('')
}

export interface DraftInput {
  /** CHANGELOG.md as it is on the branch. */
  notes: string
  /** CHANGELOG.md as it was at the release PR's previous head, if it had one. */
  previous?: string | undefined
  version: string
  date: Date
  /** Commit summaries since the last release, or since the previous head when there is one. */
  subjects: readonly string[]
  /**
   * The version the previous head's draft was for, when the release's version
   * has changed since (a fix release that a feature made a minor one, or a
   * pin): its notes carry over to the new version rather than being lost.
   */
  carriedFrom?: string | undefined
}

/** CHANGELOG.md with a section for `version` above the newest release. */
export function draftNotes(input: DraftInput): string {
  const { notes, version } = input
  if (findSection(notes, version) !== undefined) return notes

  const kept =
    input.previous === undefined
      ? undefined
      : (sectionBody(input.previous, version) ??
        (input.carriedFrom ? sectionBody(input.previous, input.carriedFrom) : undefined))
  const body = kept === undefined || kept === `- ${NOTHING_TO_SAY}` ? '' : kept
  const fresh = input.subjects
    .map(noteFor)
    .filter((note): note is string => note !== undefined)
    .map((note) => `- ${note}`)
    .filter((line) => !body.includes(line))
  const parts = [body, ...fresh].filter((part) => part !== '')
  if (parts.length === 0) parts.push(`- ${NOTHING_TO_SAY}`)
  const section = `## ${version} — ${formatDate(input.date)}\n\n${parts.join('\n')}\n`

  const first = notes.match(HEADINGS)?.[0]
  if (first === undefined) return `${notes.trimEnd()}\n\n${section}`
  const at = notes.indexOf(first)
  return `${notes.slice(0, at)}${section}\n${notes.slice(at)}`
}

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim()

// Squash merges keep only the PR's title, so a PR body's override is read from
// GitHub. Without gh or a token, the title stands.
function prBody(number: string): string {
  try {
    return execFileSync('gh', ['pr', 'view', number, '--json', 'body', '--jq', '.body'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return ''
  }
}

function subjectsIn(range: string): string[] {
  return git('log', '--no-merges', '--format=%s', range)
    .split('\n')
    .filter(Boolean)
    .flatMap((subject) => {
      const pr = /\(#(\d+)\)$/.exec(subject)?.[1]
      return (pr && overrideSubjects(prBody(pr))) || [subject]
    })
}

function draft(previousHead: string | undefined): void {
  const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }
  const notes = readFileSync(CHANGELOG, 'utf8')
  let previous: string | undefined
  if (previousHead) {
    try {
      previous = git('show', `${previousHead}:${CHANGELOG}`)
    } catch {
      previous = undefined
    }
  }
  // The previous draft's version, when it differs from this one and was never
  // released: the newest section there with no tag of its own.
  const top = previous === undefined ? undefined : HEADINGS.exec(previous)?.[1]
  HEADINGS.lastIndex = 0
  const carriedFrom =
    top !== undefined && top !== version && git('tag', '--list', `v${top}`) === '' ? top : undefined
  const hasDraft =
    previous !== undefined &&
    previousHead &&
    (findSection(previous, version) !== undefined || carriedFrom !== undefined)
  const subjects = hasDraft
    ? // The previous head sat on main as it was then; only commits after that are new.
      subjectsIn(`${git('merge-base', previousHead, 'HEAD')}..HEAD`)
    : subjectsIn(`${git('describe', '--tags', '--abbrev=0', 'HEAD^')}..HEAD`)
  writeFileSync(
    CHANGELOG,
    draftNotes({ notes, previous, version, date: new Date(), subjects, carriedFrom }),
  )
}

function section(version: string | undefined): void {
  const body = version && sectionBody(readFileSync(CHANGELOG, 'utf8'), version)
  if (!body) throw new Error(`${CHANGELOG} has no notes for ${version ?? 'no version given'}`)
  process.stdout.write(`${body}\n`)
}

if (import.meta.main) {
  const [command, argument] = process.argv.slice(2)
  if (command === 'draft') draft(argument)
  else if (command === 'section') section(argument)
  else throw new Error('usage: release-notes.ts draft [<previous head>] | section <version>')
}
