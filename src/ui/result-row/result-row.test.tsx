import { render, screen } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'
import { builtInKeyword } from '../../core/keywords'
import type { Result } from '../../core/results'
import { ResultRow } from './result-row'

const renderRow = (result: Result, active = false) =>
  render(() => (
    <ResultRow
      result={result}
      optionId="al-option-0"
      active={active}
      favicon={() => Promise.resolve(null)}
      onHover={vi.fn()}
      onActivate={vi.fn()}
    />
  ))

const tab: Result = {
  kind: 'tab',
  id: 'tab:1',
  tabId: 1,
  windowId: 1,
  title: 'Window rules',
  url: 'https://wiki.test/',
  highlights: [
    [0, 3],
    [7, 10],
  ],
}

describe('ResultRow', () => {
  it('marks the parts of the title that matched', () => {
    const { container } = renderRow(tab)
    const marks = [...container.querySelectorAll('mark')].map((m) => m.textContent)
    expect(marks).toEqual(['Win', 'rul'])
    expect(screen.getByRole('option').textContent).toContain('Window rules')
  })

  it('shows a root address without its trailing slash', () => {
    renderRow(tab)
    expect(screen.getByText('wiki.test')).toBeTruthy()
  })

  it('gives the selected row a keycap that stands out from it', () => {
    const { container } = renderRow(tab, true)
    expect(container.querySelector('kbd')?.hasAttribute('data-selected')).toBe(true)
  })

  describe('keyword rows', () => {
    const claude = builtInKeyword('claude')

    it('sends the typed text to an ask site, under the site’s letter', async () => {
      renderRow(
        {
          kind: 'site',
          id: 'site',
          keyword: claude,
          query: 'hello',
          url: 'https://claude.ai/new?q=hello',
        },
        true,
      )
      expect(screen.getByRole('option').textContent).toContain('keywordAsk')
      expect(screen.getByRole('option').textContent).toContain('actionAsk')
      expect((await screen.findByTestId('favicon-letter')).textContent).toBe('C')
    })

    it('teaches the keyword on a listed row', () => {
      renderRow({
        kind: 'keyword',
        id: 'keyword:claude',
        keyword: claude,
        url: 'https://claude.ai/new',
        listed: true,
      })
      expect(screen.getByRole('option').textContent).toContain('keywordListHint')
      expect(screen.getByRole('option').textContent).not.toContain('keywordOfferHint')
    })

    it('opens the site when nothing is typed', () => {
      renderRow(
        { kind: 'site', id: 'site', keyword: claude, query: '', url: 'https://claude.ai/new' },
        true,
      )
      expect(screen.getByRole('option').textContent).toContain('keywordOpen')
      expect(screen.getByRole('option').textContent).toContain('claude.ai/new')
    })
  })
})
