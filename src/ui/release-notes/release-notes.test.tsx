import { render, screen } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import type { Release } from '../../core/changelog'
import { ReleaseNotes } from './release-notes'

const releases: Release[] = [
  {
    version: '0.6.0',
    date: '1 December 2026',
    intro: ['A bigger release.'],
    notes: ['**Breaking:** Keywords start over.', 'Typing <b>is</b> kept.'],
    groups: [
      { notes: ['**Breaking:** Keywords start over.'] },
      { title: 'Typing', notes: ['Typing <b>is</b> kept.'] },
    ],
  },
  {
    version: '0.5.0',
    date: '25 November 2026',
    intro: [],
    notes: ['A new name.'],
    groups: [{ notes: ['A new name.'] }],
  },
]

describe('ReleaseNotes', () => {
  it('lists each release under its version and date, newest first', () => {
    render(() => <ReleaseNotes releases={releases} />)
    const headings = screen.getAllByRole('heading', { level: 3 })
    expect(headings.map((h) => h.textContent)).toEqual([
      '0.6.01 December 2026',
      '0.5.025 November 2026',
    ])
    expect(screen.getByText('A bigger release.')).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('puts each group of notes under its own heading', () => {
    render(() => <ReleaseNotes releases={releases} />)
    expect(screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent)).toEqual([
      'Typing',
    ])
    expect(screen.getAllByRole('list')).toHaveLength(3)
  })

  it('shows bold as bold and everything else as text, never as HTML', () => {
    render(() => <ReleaseNotes releases={releases} />)
    expect(screen.getByText('Breaking:').tagName).toBe('STRONG')
    expect(screen.getByText('Typing <b>is</b> kept.')).toBeTruthy()
  })

  it('marks the releases that are new to this person', () => {
    render(() => <ReleaseNotes releases={releases} fresh={new Set(['0.6.0'])} />)
    const [newest, older] = screen.getAllByRole('article')
    expect(newest?.textContent).toContain('settingsReleaseNew')
    expect(older?.textContent).not.toContain('settingsReleaseNew')
  })
})
