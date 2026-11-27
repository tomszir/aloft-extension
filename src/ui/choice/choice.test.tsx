import { fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
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

  it('slides the highlight to the newly picked option', () => {
    const animate = vi.fn()
    HTMLElement.prototype.animate = animate
    document.documentElement.style.setProperty('--al-duration-move', '200ms')
    try {
      const [value, setValue] = createSignal<'a' | 'b'>('a')
      render(() => (
        <Choice
          label="Pick"
          options={[
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
          ]}
          value={value()}
          onChange={setValue}
        />
      ))
      expect(animate).not.toHaveBeenCalled()
      setValue('b')
      expect(animate).toHaveBeenCalledOnce()
      expect(animate.mock.calls[0]?.[1]).toMatchObject({ pseudoElement: '::before' })
    } finally {
      // @ts-expect-error happy-dom has no Web Animations to put back.
      delete HTMLElement.prototype.animate
      document.documentElement.style.removeProperty('--al-duration-move')
    }
  })
})
