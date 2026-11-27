import { fireEvent, render, screen } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'
import { Toggle } from './toggle'

describe('Toggle', () => {
  it('is a switch named by its label and described by its note', () => {
    const onChange = vi.fn()
    render(() => <Toggle label="Blur" checked={false} onChange={onChange} note="Behind Aloft" />)
    const toggle = screen.getByRole('switch', { name: 'Blur' })
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    expect(toggle.getAttribute('aria-describedby')).toBe(screen.getByText('Behind Aloft').id)
    fireEvent.click(toggle)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('flips from anywhere on its row, the note included', () => {
    const onChange = vi.fn()
    render(() => <Toggle label="Blur" checked={false} onChange={onChange} note="Behind Aloft" />)
    fireEvent.click(screen.getByText('Behind Aloft'))
    expect(onChange).toHaveBeenCalledWith(true)
  })
})
