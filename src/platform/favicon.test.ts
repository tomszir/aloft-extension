import { describe, expect, it } from 'vitest'
import type { TabEntry } from '../core/results'
import { pageFavicon, rememberTabIcons } from './favicon'

const PNG = 'data:image/png;base64,iVBORw0KGgo='

const tab = (url: string, icon?: string): TabEntry => ({
  tabId: 1,
  windowId: 1,
  index: 0,
  pinned: false,
  loaded: true,
  title: url,
  url,
  lastAccessed: 0,
  ...(icon && { icon }),
})

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

  it.runIf(import.meta.env.FIREFOX)('shows the data: icon an open tab holds for the page', () => {
    rememberTabIcons([tab('https://c.test/', PNG), tab('https://d.test/')])
    expect(pageFavicon('https://c.test/')).toBe(PNG)
    expect(pageFavicon('https://d.test/')).toBeNull()
  })
})
