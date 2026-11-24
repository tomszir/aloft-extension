import { fireEvent, render, screen } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'
import { Toggle } from './toggle'

describe('Toggle', () => {
  it('is a labelled switch that reports the new state', () => {
    const onChange = vi.fn()
    render(() => <Toggle label="Blur" checked={false} onChange={onChange} note="Behind Aloft" />)
    const toggle = screen.getByRole('switch', { name: 'Blur' })
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    expect(toggle.getAttribute('aria-describedby')).toBe(screen.getByText('Behind Aloft').id)
    fireEvent.click(toggle)
    expect(onChange).toHaveBeenCalledWith(true)
  })
})
