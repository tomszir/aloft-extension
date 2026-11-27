import { render, screen } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { Button } from './button'
import styles from './button.module.css'

describe('Button', () => {
  it('is a plain secondary button unless asked otherwise', () => {
    render(() => <Button>Save</Button>)
    const button = screen.getByRole('button', { name: 'Save' })
    expect(button.getAttribute('type')).toBe('button')
    expect(button.classList.contains(styles.secondary ?? '')).toBe(true)
    expect(button.classList.contains(styles.danger ?? '')).toBe(false)
  })

  it('draws a ghost danger button with its icon', () => {
    render(() => (
      <Button variant="ghost" danger icon="plus">
        Reset
      </Button>
    ))
    const button = screen.getByRole('button', { name: 'Reset' })
    expect(button.classList.contains(styles.ghost ?? '')).toBe(true)
    expect(button.classList.contains(styles.danger ?? '')).toBe(true)
    expect(button.querySelector('svg')).not.toBeNull()
  })
})
