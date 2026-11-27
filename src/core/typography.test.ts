import { describe, expect, it } from 'vitest'
import { densityTokens, fontFamily } from './typography'

describe('fontFamily', () => {
  it('gives each choice a stack that ends in a generic family', () => {
    expect(fontFamily('system', '')).toBe('system-ui, sans-serif')
    expect(fontFamily('mono', '')).toMatch(/monospace$/)
    expect(fontFamily('serif', '')).toMatch(/serif$/)
  })

  it('puts a custom font first, falling back to the system font', () => {
    expect(fontFamily('custom', 'Atkinson Hyperlegible')).toBe(
      '"Atkinson Hyperlegible", system-ui, sans-serif',
    )
    expect(fontFamily('custom', '')).toBe('system-ui, sans-serif')
  })

  it("won't let a custom name close its quotes and add CSS", () => {
    expect(fontFamily('custom', 'x"; color: red')).toBe('system-ui, sans-serif')
  })
})

describe('densityTokens', () => {
  it('leaves the default sizes alone and scales the others together', () => {
    expect(densityTokens('default')).toEqual({})
    expect(densityTokens('compact')['--al-row-height']).toBe('36px')
    expect(densityTokens('comfortable')['--al-row-height']).toBe('50px')
  })
})
