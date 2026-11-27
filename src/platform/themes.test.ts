import { describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import { PRESET_THEMES, type Theme } from '../core/theme'
import { loadCustomThemes, saveCustomThemes } from './themes'

const mine = { ...(PRESET_THEMES[0] as Theme), id: 'custom-mine', name: 'Mine' }

describe('custom themes in sync storage', () => {
  it('saves and reads back what fits', async () => {
    expect(await saveCustomThemes([mine])).toBe('saved')
    expect(await loadCustomThemes()).toEqual([mine])
  })

  it('reports a write sync storage refuses instead of throwing', async () => {
    vi.spyOn(browser.storage.sync, 'set').mockRejectedValue(new Error('QUOTA_BYTES quota exceeded'))
    expect(await saveCustomThemes([mine])).toBe('failed')
  })
})
