import { render, screen } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'
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
})
