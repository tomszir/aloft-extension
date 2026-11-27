import { fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TOUR_THEMES } from '../instrument'
import type { DemoSignal } from '../session'
import { Tour, type TourProps } from './tour'

let emit: (signal: DemoSignal) => void

const props = (overrides: Partial<TourProps> = {}): TourProps => ({
  subscribe: (listener) => {
    emit = listener
    return () => undefined
  },
  touch: false,
  themes: TOUR_THEMES,
  themeId: 'instrument-dark',
  onTheme: vi.fn(),
  onRefocus: vi.fn(),
  onSkip: vi.fn(),
  onFinish: vi.fn(),
  onEscape: vi.fn(),
  ...overrides,
})

const count = () => screen.getByText(/^\d \/ 5$/).textContent

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Tour', () => {
  it('starts on the first step, with its count', () => {
    render(() => <Tour {...props()} />)
    expect(count()).toBe('1 / 5')
    expect(screen.getByRole('heading').textContent).toContain('Search everything')
  })

  it('moves on once the step is done, after a pause in typing', () => {
    render(() => <Tour {...props()} />)
    emit({ kind: 'search', text: 'ha' })
    expect(screen.getByRole('heading').textContent).toContain('Done.')
    vi.advanceTimersByTime(1000)
    emit({ kind: 'search', text: 'han' })
    vi.advanceTimersByTime(1000)
    expect(count()).toBe('1 / 5')
    vi.advanceTimersByTime(600)
    expect(count()).toBe('2 / 5')
  })

  it('ignores what belongs to another step', () => {
    render(() => <Tour {...props()} />)
    emit({ kind: 'theme' })
    vi.advanceTimersByTime(5000)
    expect(count()).toBe('1 / 5')
  })

  it('draws keys as keycaps, and asks touch screens for a tap', () => {
    const { unmount } = render(() => <Tour {...props()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Alt+1').tagName).toBe('KBD')
    unmount()
    render(() => <Tour {...props({ touch: true })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.queryByText('Alt+1')).toBeNull()
    expect(screen.getByText(/tap a pinned tab/)).toBeTruthy()
  })

  it('offers the themes on the last step, and finishes there', () => {
    const p = props()
    render(() => <Tour {...p} />)
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(count()).toBe('5 / 5')
    fireEvent.click(screen.getByRole('radio', { name: 'Instrument Light' }))
    expect(p.onTheme).toHaveBeenCalledWith('instrument-light')
    emit({ kind: 'theme' })
    vi.advanceTimersByTime(5000)
    expect(count()).toBe('5 / 5')
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }))
    expect(p.onFinish).toHaveBeenCalled()
  })

  it('puts focus back in the bar after a click, and skips', () => {
    const p = props()
    render(() => <Tour {...p} />)
    const skip = screen.getByRole('button', { name: 'Skip tour' })
    fireEvent.pointerDown(skip)
    fireEvent.click(skip)
    expect(p.onSkip).toHaveBeenCalled()
    expect(p.onRefocus).toHaveBeenCalled()
  })

  it('announces each step', () => {
    render(() => <Tour {...props()} />)
    const live = screen.getByRole('heading').closest('[aria-live]')
    expect(live?.getAttribute('aria-live')).toBe('polite')
  })

  it('hands Esc on its own controls to the demo', () => {
    const p = props()
    render(() => <Tour {...p} />)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Next' }), { key: 'Escape' })
    expect(p.onEscape).toHaveBeenCalled()
  })
})
