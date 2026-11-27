import { describe, expect, it } from 'vitest'
import { type ActionContext, availableActions } from './actions'

const over: ActionContext = {
  overPage: true,
  hostPinned: false,
  otherTabsInWindow: 3,
  otherUnpinnedTabs: 2,
  hasRecentlyClosed: true,
}

describe('availableActions', () => {
  it('offers everything over a normal page', () => {
    expect(availableActions(over)).toEqual([
      'pin',
      'duplicate',
      'move-to-new-window',
      'close-other-tabs',
      'new-tab',
      'new-window',
      'reopen-closed-tab',
      'open-settings',
    ])
  })

  it('offers unpin instead of pin on a pinned tab', () => {
    const actions = availableActions({ ...over, hostPinned: true })
    expect(actions).toContain('unpin')
    expect(actions).not.toContain('pin')
  })

  it('leaves out actions that need other tabs when this is the only one', () => {
    const actions = availableActions({ ...over, otherTabsInWindow: 0, otherUnpinnedTabs: 0 })
    expect(actions).not.toContain('move-to-new-window')
    expect(actions).not.toContain('close-other-tabs')
  })

  it('has nothing to close when the only other tabs are pins', () => {
    const actions = availableActions({ ...over, otherUnpinnedTabs: 0 })
    expect(actions).toContain('move-to-new-window')
    expect(actions).not.toContain('close-other-tabs')
  })

  it('only offers page-free actions on its own pages', () => {
    expect(availableActions({ ...over, overPage: false })).toEqual([
      'new-tab',
      'new-window',
      'reopen-closed-tab',
      'open-settings',
    ])
  })

  it('hides reopen when nothing was closed', () => {
    expect(availableActions({ ...over, hasRecentlyClosed: false })).not.toContain(
      'reopen-closed-tab',
    )
  })
})
