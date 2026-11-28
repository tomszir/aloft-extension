import { describe, expect, it, vi } from 'vitest'
import { type Browser, browser } from 'wxt/browser'
import { loadTabs } from './sources'

const tab = (favIconUrl: string | undefined): Browser.tabs.Tab => ({
  id: 4,
  index: 0,
  windowId: 1,
  active: false,
  highlighted: false,
  pinned: false,
  incognito: false,
  frozen: false,
  selected: false,
  discarded: false,
  autoDiscardable: true,
  groupId: -1,
  lastAccessed: 0,
  status: 'complete',
  title: 'Notes',
  url: 'https://notes.test/',
  favIconUrl,
})

const iconOf = async (favIconUrl: string | undefined) => {
  vi.spyOn(browser.tabs, 'query').mockImplementation(async () => [tab(favIconUrl)])
  const [entry] = await loadTabs()
  return entry?.icon
}

const PNG = 'data:image/png;base64,iVBORw0KGgo='

describe('loadTabs', () => {
  it.runIf(import.meta.env.FIREFOX)('keeps the icon a tab holds as a data: image', async () => {
    expect(await iconOf(PNG)).toBe(PNG)
  })

  it.runIf(import.meta.env.FIREFOX)(
    'leaves out icons that loading would fetch, and very large ones',
    async () => {
      expect(await iconOf('https://notes.test/favicon.ico')).toBeUndefined()
      expect(await iconOf('data:text/html,<p>hi</p>')).toBeUndefined()
      expect(await iconOf(`${PNG}${'A'.repeat(20_000)}`)).toBeUndefined()
      expect(await iconOf(undefined)).toBeUndefined()
    },
  )

  it.skipIf(import.meta.env.FIREFOX)(
    'never carries icons where the favicon cache has them',
    async () => {
      expect(await iconOf(PNG)).toBeUndefined()
    },
  )
})
