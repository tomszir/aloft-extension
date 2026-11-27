import { describe, expect, it } from 'vitest'
import { opensWithNewTabKey } from './shortcut'

describe('opensWithNewTabKey', () => {
  it('recognises Ctrl+T on either shortcut, as each browser writes it', () => {
    expect(opensWithNewTabKey({ main: 'Alt+Q', second: 'Ctrl+T' })).toBe(true)
    expect(opensWithNewTabKey({ main: 'Ctrl+T', second: '' })).toBe(true)
    expect(opensWithNewTabKey({ main: 'Alt+Q', second: '⌘T' })).toBe(true)
    expect(opensWithNewTabKey({ main: 'Alt+Q', second: 'Command+T' })).toBe(true)
  })

  it('ignores other keys and unset shortcuts', () => {
    expect(opensWithNewTabKey({ main: 'Alt+Q', second: '' })).toBe(false)
    expect(opensWithNewTabKey({ main: 'Ctrl+Shift+T', second: 'Alt+T' })).toBe(false)
  })
})
