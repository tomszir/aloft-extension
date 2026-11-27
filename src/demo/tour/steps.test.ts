import { describe, expect, it } from 'vitest'
import { t } from '../i18n'
import { advanceAfter, completes, STEPS, withKeys } from './steps'

describe('tour steps', () => {
  it('has five steps, each with a key for every placeholder', () => {
    expect(STEPS.map((s) => s.id)).toEqual(['search', 'pin', 'actions', 'site', 'theme'])
    const placeholders = (text: string) => withKeys(text).filter((p) => typeof p === 'number')
    for (const step of STEPS) {
      expect(placeholders(t(step.body))).toEqual(step.keys.map((_, i) => i))
      if (step.touchBody) expect(placeholders(t(step.touchBody))).toEqual([])
    }
  })

  it('finishes each step only on what it asks for', () => {
    expect(completes('search', { kind: 'search', text: 'h' })).toBe(false)
    expect(completes('search', { kind: 'search', text: 'ha' })).toBe(true)
    expect(completes('pin', { kind: 'open-pin' })).toBe(true)
    expect(completes('pin', { kind: 'action', action: 'pin' })).toBe(false)
    expect(completes('actions', { kind: 'action', action: 'pin' })).toBe(true)
    expect(completes('site', { kind: 'keyword' })).toBe(true)
    expect(completes('theme', { kind: 'theme' })).toBe(true)
    expect(completes('theme', { kind: 'keyword' })).toBe(false)
  })

  it('waits for Finish on the last step', () => {
    expect(advanceAfter('theme')).toBeUndefined()
    expect(advanceAfter('search')).toBeGreaterThan(advanceAfter('pin') ?? 0)
  })

  it('splits text around its keys', () => {
    expect(withKeys('Type $1 and Space, or $2.')).toEqual(['Type ', 0, ' and Space, or ', 1, '.'])
    expect(withKeys('No keys')).toEqual(['No keys'])
  })
})
