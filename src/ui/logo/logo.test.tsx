import { render, screen } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { Logo } from './logo'

describe('Logo', () => {
  it('is decorative unless it is the only thing naming Aloft', () => {
    const { container } = render(() => <Logo />)
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('')
    render(() => <Logo label="Aloft" />)
    expect(screen.getByRole('img', { name: 'Aloft' })).toBeTruthy()
  })
})
