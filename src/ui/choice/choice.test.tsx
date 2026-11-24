import { fireEvent, render, screen } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'
import { Choice } from './choice'

describe('Choice', () => {
  it('is a named radio group with the current value checked', () => {
    const onChange = vi.fn()
    render(() => (
      <Choice
        label="Position"
        options={[
          { value: 'top', label: 'Top' },
          { value: 'center', label: 'Center' },
        ]}
        value="top"
        onChange={onChange}
      />
    ))
    expect(screen.getByRole('group', { name: 'Position' })).toBeTruthy()
    expect((screen.getByRole('radio', { name: 'Top' }) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByRole('radio', { name: 'Center' }))
    expect(onChange).toHaveBeenCalledWith('center')
  })
})
