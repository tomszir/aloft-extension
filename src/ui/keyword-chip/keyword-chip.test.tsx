import { render, screen, waitFor } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'
import { builtInKeyword } from '../../core/keywords'
import { KeywordChip } from './keyword-chip'

const youtube = builtInKeyword('youtube')

describe('KeywordChip', () => {
  it('takes its colour from the site’s icon', async () => {
    const color = vi.fn(async () => '#ff0000')
    render(() => <KeywordChip keyword={youtube} favicon={async () => 'icon.png'} color={color} />)
    const chip = screen.getByText('YouTube')
    await waitFor(() => expect(chip.hasAttribute('data-colored')).toBe(true))
    expect(chip.style.getPropertyValue('--al-chip-color')).toBe('#ff0000')
    expect(color).toHaveBeenCalledWith('icon.png')
  })

  it('keeps the theme’s accent without an icon or a colour', async () => {
    const color = vi.fn(async () => null)
    render(() => <KeywordChip keyword={youtube} favicon={async () => null} color={color} />)
    await screen.findByTestId('favicon-letter')
    expect(screen.getByText('YouTube').hasAttribute('data-colored')).toBe(false)
    expect(color).not.toHaveBeenCalled()
  })
})
