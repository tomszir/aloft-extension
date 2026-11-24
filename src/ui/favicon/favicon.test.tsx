import { fireEvent, render, screen } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { Favicon } from './favicon'

describe('Favicon', () => {
  it('shows the icon once the browser has one for the page', async () => {
    const { container } = render(() => (
      <Favicon pageUrl="https://a.test/" load={async () => 'icon.png'} letter="A" />
    ))
    await screen.findByRole('presentation', { hidden: true })
    expect(container.querySelector('img')?.getAttribute('src')).toBe('icon.png')
    expect(screen.queryByTestId('favicon-letter')).toBeNull()
  })

  it('shows the letter tile when the browser only has its generic icon', async () => {
    const { container } = render(() => (
      <Favicon pageUrl="https://a.test/" load={async () => null} letter="A" />
    ))
    expect((await screen.findByTestId('favicon-letter')).textContent).toBe('A')
    expect(container.querySelector('img')).toBeNull()
  })

  it('shows nothing while the icon is being checked', () => {
    const { container } = render(() => (
      <Favicon pageUrl="https://a.test/" load={() => new Promise(() => {})} letter="A" />
    ))
    expect(container.firstElementChild?.childElementCount).toBe(0)
  })

  it('marks an icon that is all but black, so the tile can back it', async () => {
    const { container } = render(() => (
      <Favicon
        pageUrl="https://a.test/"
        load={async () => 'icon.png'}
        letter="A"
        tone={() => 'dark'}
      />
    ))
    const image = await screen.findByRole('presentation', { hidden: true })
    expect(container.firstElementChild?.hasAttribute('data-tone')).toBe(false)
    fireEvent.load(image)
    expect(container.firstElementChild?.getAttribute('data-tone')).toBe('dark')
  })
})
