import { render, screen } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { ShortcutSentence } from './shortcut-sentence'

describe('ShortcutSentence', () => {
  it('shows the shortcut as a key cap', () => {
    const { container } = render(() => <ShortcutSentence shortcut="Alt+Q" />)
    expect(container.querySelector('kbd')?.textContent).toBe('Alt+Q')
  })

  it('explains that there is no shortcut when none is set', () => {
    const { container } = render(() => <ShortcutSentence shortcut="" />)
    expect(container.querySelector('kbd')).toBeNull()
    expect(screen.getByText('onboardingNoShortcut')).toBeTruthy()
  })
})
