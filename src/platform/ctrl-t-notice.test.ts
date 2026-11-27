import { describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { tellCtrlTUsers } from './ctrl-t-notice'

describe('tellCtrlTUsers', () => {
  it('shows how to set Ctrl+T to people who had it replace the new tab page', async () => {
    const create = vi.spyOn(browser.tabs, 'create')
    await tellCtrlTUsers('0.5.0')
    expect(create).toHaveBeenCalledWith({ url: expect.stringMatching(/onboarding\.html#ctrl-t$/) })
  })

  it('stays quiet for people who had switched it off, and on later updates', async () => {
    const create = vi.spyOn(browser.tabs, 'create')
    await fakeBrowser.storage.sync.set({ settings: { replaceNewTab: false } })
    await tellCtrlTUsers('0.5.0')
    await fakeBrowser.storage.sync.set({ settings: { replaceNewTab: true } })
    await tellCtrlTUsers('1.0.0')
    expect(create).not.toHaveBeenCalled()
  })
})
