import { afterEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import { NEW_TAB_STAYS } from './messages'
import { newTabStays, takeFocusFromAddressBar } from './newtab-page'

describe('newTabStays', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('asks the background and resolves with its answer', async () => {
    const send = vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue(undefined)
    await newTabStays()
    expect(send).toHaveBeenCalledWith({ type: NEW_TAB_STAYS })
  })

  it('resolves when nothing in the background answers', async () => {
    vi.spyOn(browser.runtime, 'sendMessage').mockRejectedValue(new Error('no receiver'))
    await expect(newTabStays()).resolves.toBeUndefined()
  })

  it('gives up on a background that never answers', async () => {
    vi.useFakeTimers()
    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(() => new Promise(() => {}))
    let done = false
    void newTabStays().then(() => {
      done = true
    })
    await vi.advanceTimersByTimeAsync(999)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(done).toBe(true)
  })
})

describe('takeFocusFromAddressBar', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const stubLocation = (search: string) => {
    const location = { search, replace: vi.fn() }
    vi.stubGlobal('location', location)
    return location
  }

  it('replaces a fresh new tab page with itself once', () => {
    const location = stubLocation('')
    expect(takeFocusFromAddressBar()).toBe(true)
    expect(location.replace).toHaveBeenCalledWith('?focus')
  })

  it('leaves the page it replaced alone', () => {
    const location = stubLocation('?focus')
    expect(takeFocusFromAddressBar()).toBe(false)
    expect(location.replace).not.toHaveBeenCalled()
  })
})
