import { render, screen } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'
import { builtInKeyword } from '../../core/keywords'
import type { Result } from '../../core/results'
import { ResultRow } from './result-row'

const renderRow = (result: Result, active = false, enterOpensIn?: 'new-tab' | 'current-tab') =>
  render(() => (
    <ResultRow
      result={result}
      optionId="al-option-0"
      active={active}
      enterOpensIn={enterOpensIn}
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

  describe('where Enter opens', () => {
    const page: Result = {
      kind: 'history',
      id: 'history:x',
      title: 'Docs',
      url: 'https://docs.test/',
    }

    it('offers both places on a selected page, the preferred one on Enter', () => {
      renderRow(page, true, 'current-tab')
      const text = screen.getByRole('option').textContent ?? ''
      expect(text.indexOf('openHere')).toBeLessThan(text.indexOf('openNewTab'))
      expect(text).toContain('⇧ ↵')
    })

    it('names only the verb where Enter always opens in place', () => {
      renderRow(page, true)
      expect(screen.getByRole('option').textContent).toContain('actionOpen')
      expect(screen.getByRole('option').textContent).not.toContain('⇧')
    })

    it('keeps an open tab to one key, since it only switches', () => {
      renderRow(tab, true, 'new-tab')
      expect(screen.getByRole('option').textContent).toContain('actionSwitch')
      expect(screen.getByRole('option').textContent).not.toContain('⇧')
    })
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

    it('ends a listed row with its keyword, and shows the site instead', () => {
      const listed: Result = {
        kind: 'keyword',
        id: 'keyword:claude',
        keyword: claude,
        url: 'https://claude.ai/new',
        listed: true,
      }
      renderRow(listed)
      const row = screen.getByRole('option')
      expect(row.textContent).toContain('claude.ai/new')
      expect(row.textContent).toContain('cl')
      expect(row.textContent).not.toContain('keywordOfferHint')
      expect(row.querySelector('[data-shown]')).toBeNull()
    })

    it('ends a scope row with @ and its name, which is what makes its chip', () => {
      renderRow({ kind: 'scope', id: 'scope:bookmarks', scope: 'bookmarks' }, true)
      const row = screen.getByRole('option')
      expect(row.textContent).toContain('sectionBookmarks')
      expect(row.textContent).toContain('placeholderBookmarks')
      expect(row.textContent).toContain('@bookmarks')
      expect(row.querySelector('[data-shown]')).toBeTruthy()
    })

    it('asks for the site’s icon, not the search address that changes as you type', () => {
      const favicon = vi.fn(() => null)
      render(() => (
        <ResultRow
          result={{
            kind: 'site',
            id: 'site',
            keyword: claude,
            query: 'hello',
            url: 'https://claude.ai/new?q=hello',
          }}
          optionId="al-option-0"
          active={false}
          favicon={favicon}
          onHover={vi.fn()}
          onActivate={vi.fn()}
        />
      ))
      expect(favicon).toHaveBeenCalledWith('https://claude.ai/new')
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
