import { describe, expect, it } from 'vitest'
import { pageFavicon } from './favicon'

describe('pageFavicon', () => {
  it.skipIf(import.meta.env.FIREFOX)("looks the page up in the browser's favicon cache", () => {
    expect(pageFavicon('https://a.test/')).toBeInstanceOf(Promise)
  })

  it.runIf(import.meta.env.FIREFOX)(
    'answers with the letter tile at once in Firefox, without a lookup',
    () => {
      expect(pageFavicon('https://b.test/')).toBeNull()
    },
  )
})
