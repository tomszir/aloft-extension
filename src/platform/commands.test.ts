import { describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import { openShortcutSettings } from './commands'

describe('openShortcutSettings', () => {
  it("opens the browser's shortcuts page where there's no call for it", () => {
    const create = vi.spyOn(browser.tabs, 'create')

    openShortcutSettings()

    expect(create).toHaveBeenCalledWith({ url: 'chrome://extensions/shortcuts' })
  })

  it("uses the browser's own call where there is one, as in Firefox", () => {
    const open = vi.fn(async () => {})
    Reflect.set(browser.commands, 'openShortcutSettings', open)
    const create = vi.spyOn(browser.tabs, 'create')

    try {
      openShortcutSettings()
    } finally {
      Reflect.deleteProperty(browser.commands, 'openShortcutSettings')
    }

    expect(open).toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })
})
