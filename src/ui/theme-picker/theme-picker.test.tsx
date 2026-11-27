import { fireEvent, render, screen } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'
import { PRESET_THEMES } from '../../core/theme'
import { ThemePicker } from './theme-picker'

describe('ThemePicker', () => {
  it('draws each theme in its own colors and picks one by id', () => {
    const onChange = vi.fn()
    const [first, second] = PRESET_THEMES
    if (!first || !second) throw new Error('missing presets')
    render(() => (
      <ThemePicker label="Theme" themes={[first, second]} value={first.id} onChange={onChange} />
    ))
    // Set around the card, so its edit button is drawn in the same colors.
    const card = screen.getByRole('radio', { name: second.name }).closest('label')?.parentElement
    expect(card?.style.getPropertyValue('--al-panel')).toBe(second.colors.panel)
    fireEvent.click(screen.getByRole('radio', { name: second.name }))
    expect(onChange).toHaveBeenCalledWith(second.id)
  })

  it("edits only the person's own themes, and starts a new one from the card at the end", () => {
    const [first, second] = PRESET_THEMES
    if (!first || !second) throw new Error('missing presets')
    const onEdit = vi.fn()
    const onNew = vi.fn()
    const mine = { ...second, id: 'custom-mine', name: 'Mine' }
    render(() => (
      <ThemePicker
        label="Theme"
        themes={[first, mine]}
        value={first.id}
        onChange={vi.fn()}
        customIds={new Set(['custom-mine'])}
        onEdit={onEdit}
        onNew={onNew}
      />
    ))
    const edits = screen.getAllByRole('button', { name: 'themeEditNamed' })
    expect(edits).toHaveLength(1)
    fireEvent.click(edits[0] as HTMLElement)
    expect(onEdit).toHaveBeenCalledWith(mine)
    fireEvent.click(screen.getByRole('button', { name: 'themeNew' }))
    expect(onNew).toHaveBeenCalledOnce()
  })
})
