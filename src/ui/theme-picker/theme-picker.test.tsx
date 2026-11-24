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
    const card = screen.getByRole('radio', { name: second.name }).closest('label')
    expect(card?.style.getPropertyValue('--al-panel')).toBe(second.colors.panel)
    fireEvent.click(screen.getByRole('radio', { name: second.name }))
    expect(onChange).toHaveBeenCalledWith(second.id)
  })
})
