import { waitFor } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { type DemoHandle, mountDemo } from './index'

let demo: DemoHandle | undefined
let host: HTMLElement

afterEach(() => {
  demo?.destroy()
  demo = undefined
  host?.remove()
})

function mount(options: Parameters<typeof mountDemo>[1] = {}) {
  host = document.createElement('div')
  document.body.append(host)
  demo = mountDemo(host, { scheme: 'dark', ...options })
  return demo
}

const shadow = () => host.shadowRoot
const input = () => shadow()?.querySelector<HTMLInputElement>('input[role="combobox"]')

describe('mountDemo', () => {
  it('draws nothing and listens to nothing until opened', () => {
    const listen = vi.spyOn(window, 'addEventListener')
    mount()
    expect(shadow()?.querySelector('[role="dialog"]')).toBeNull()
    expect(listen).not.toHaveBeenCalled()
  })

  it('opens the real palette in its shadow root, in the Instrument theme', async () => {
    mount().open()
    await waitFor(() => expect(input()).toBeTruthy())
    const shell = shadow()?.querySelector<HTMLElement>('.shell')
    expect(shell?.dataset.scheme).toBe('dark')
    expect(shell?.style.getPropertyValue('--al-panel').toUpperCase()).toBe('#0B0B0A')
    // The theme goes on the demo's own element, never the page's.
    expect(document.documentElement.style.getPropertyValue('--al-panel')).toBe('')
    expect(document.documentElement.dataset.scheme).toBeUndefined()
  })

  it('follows the scheme the page switches to', async () => {
    const d = mount()
    d.open()
    await waitFor(() => expect(input()).toBeTruthy())
    d.setScheme('light')
    const shell = shadow()?.querySelector<HTMLElement>('.shell')
    await waitFor(() => expect(shell?.dataset.scheme).toBe('light'))
    expect(shell?.style.getPropertyValue('--al-panel').toUpperCase()).toBe('#F7F7F5')
  })

  it('closes on Esc, hands focus back and leaves no listeners behind', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({
          matches: query.includes('reduced-motion'),
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList,
    )
    const button = document.createElement('button')
    document.body.append(button)
    button.focus()
    const added = vi.spyOn(window, 'addEventListener')
    const removed = vi.spyOn(window, 'removeEventListener')
    const onClose = vi.fn()
    mount({ onClose }).open()
    await waitFor(() => expect(input()).toBeTruthy())
    input()?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
    )
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(shadow()?.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(button)
    for (const [type, listener] of added.mock.calls) {
      expect(removed.mock.calls.some(([t, l]) => t === type && l === listener)).toBe(true)
    }
    button.remove()
  })

  it('shows the tour when asked, and starts it over on a fresh set of tabs', async () => {
    const d = mount({ tour: true })
    d.open()
    await waitFor(() => expect(shadow()?.querySelector('section[aria-label="Tour"]')).toBeTruthy())
    expect(shadow()?.textContent).toContain('1 / 5')
    d.startTour()
    expect(shadow()?.textContent).toContain('1 / 5')
  })
})
