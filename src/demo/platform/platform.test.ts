import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../../core/settings'
import { INSTRUMENT_THEMES } from '../instrument'
import { DemoSession, type SessionHooks, setSession } from '../session'
import { PINS, TABS } from '../sites'
import { pageFavicon } from './favicon'
import { loadLearned, savePick } from './learned'
import {
  closeOverlay,
  closeTab,
  currentTab,
  loadRecentlyClosed,
  loadTabs,
  openResult,
  runAction,
  searchHistory,
  takeTyped,
  unpin,
  watchTabs,
} from './palette-api'
import { loadSettings, saveSettings, watchSettings } from './settings'
import { loadCustomThemes, saveCustomThemes } from './themes'

let hooks: { [K in keyof SessionHooks]: Mock<SessionHooks[K]> }
let session: DemoSession

beforeEach(() => {
  hooks = {
    would: vi.fn<SessionHooks['would']>(),
    dismiss: vi.fn<SessionHooks['dismiss']>(),
    reopen: vi.fn<SessionHooks['reopen']>(),
    signal: vi.fn<SessionHooks['signal']>(),
  }
  session = new DemoSession(DEFAULT_SETTINGS, INSTRUMENT_THEMES, hooks)
  setSession(session)
})

afterEach(() => setSession(undefined))

const context = async () => ({
  host: (await currentTab()) ?? { id: 0, index: 0, windowId: 0 },
  openTabs: await loadTabs(),
  switchToOpenTabs: true,
})

describe('the demo platform', () => {
  it('pins the tab it sits on, and the change shows on the next read', async () => {
    const host = await currentTab()
    if (!host) throw new Error('no host tab')
    const changed = vi.fn()
    watchTabs(changed)
    await runAction('pin', { host })
    expect((await loadTabs()).filter((t) => t.pinned)).toHaveLength(PINS.length + 1)
    expect(changed).toHaveBeenCalled()
    expect(hooks.signal).toHaveBeenCalledWith({ kind: 'action', action: 'pin' })
  })

  it('closes and reopens tabs', async () => {
    const host = await currentTab()
    const docs = (await loadTabs()).find((t) => t.title === TABS[1]?.title)
    if (!host || !docs) throw new Error('missing tab')
    await closeTab(docs.tabId)
    expect((await loadRecentlyClosed())[0]?.title).toBe(docs.title)
    await runAction('reopen-closed-tab', { host })
    expect((await loadTabs()).map((t) => t.title)).toContain(docs.title)
    expect(hooks.would).toHaveBeenCalledWith(expect.stringContaining(docs.title))
  })

  it('unpins from the pinned row', async () => {
    const [first] = await loadTabs()
    if (!first) throw new Error('missing pin')
    await unpin(first.tabId)
    expect((await loadTabs()).filter((t) => t.pinned)).toHaveLength(PINS.length - 1)
  })

  it('says where it would go instead of going there', async () => {
    const pin = (await loadTabs()).find((t) => t.pinned)
    if (!pin) throw new Error('missing pin')
    const replaced = await openResult(
      { kind: 'tab', id: 'tab', tabId: pin.tabId, windowId: 1, title: pin.title, url: pin.url },
      'new-tab',
      await context(),
    )
    expect(replaced).toBe(false)
    expect(hooks.would).toHaveBeenLastCalledWith(`Would switch to ${pin.title}`)
    expect(hooks.signal).toHaveBeenCalledWith({ kind: 'open-pin' })

    await openResult({ kind: 'search', id: 's', query: 'sourdough' }, 'new-tab', await context())
    expect(hooks.would).toHaveBeenLastCalledWith('Would search the web for “sourdough”')

    await runAction('history', { host: (await context()).host })
    expect(hooks.would).toHaveBeenLastCalledWith('Would run “History”')
  })

  it('switches to a page already open instead of opening it again', async () => {
    const before = (await loadTabs()).length
    await openResult(
      {
        kind: 'history',
        id: 'h',
        title: 'Weekend trip — Waypoint',
        url: 'https://maps.aloft.test/',
      },
      'new-tab',
      await context(),
    )
    expect(hooks.would).toHaveBeenLastCalledWith('Would switch to Weekend trip — Waypoint')
    expect(await loadTabs()).toHaveLength(before)
  })

  it('opens a page in a new tab, which then counts as open', async () => {
    const page = { title: 'Weeknight dal — Crumb', url: 'https://recipes.aloft.test/dal' }
    await openResult({ kind: 'history', id: 'h', ...page }, 'new-tab', await context())
    expect(hooks.would).toHaveBeenLastCalledWith('Would open Weeknight dal — Crumb in a new tab')
    expect((await loadTabs()).map((t) => t.url)).toContain(page.url)
  })

  it('opens the bar again after acting, and closes it otherwise', async () => {
    await closeOverlay(0)
    expect(hooks.dismiss).toHaveBeenCalledTimes(1)
    const host = await currentTab()
    if (!host) throw new Error('no host tab')
    await runAction('duplicate', { host })
    await closeOverlay(host.id)
    expect(hooks.reopen).toHaveBeenCalledTimes(1)
    expect(hooks.dismiss).toHaveBeenCalledTimes(1)
  })

  it('tells the tour what was searched', async () => {
    expect((await searchHistory('handbook')).length).toBeGreaterThan(0)
    expect(hooks.signal).toHaveBeenCalledWith({ kind: 'search', text: 'handbook' })
  })

  it('keeps settings, themes and learned picks in memory', async () => {
    const watched = vi.fn()
    watchSettings(watched)
    const next = {
      ...DEFAULT_SETTINGS,
      appearance: { ...DEFAULT_SETTINGS.appearance, darkTheme: 'instrument-dark' },
    }
    await saveSettings(next)
    expect(await loadSettings()).toBe(next)
    expect(watched).toHaveBeenCalledWith(next)
    expect(hooks.signal).toHaveBeenCalledWith({ kind: 'theme' })

    expect(await saveCustomThemes([])).toBe('saved')
    expect(await loadCustomThemes()).toEqual([])

    await savePick('wee', { url: 'https://maps.aloft.test/', title: 'Weekend trip' })
    expect((await loadLearned()).picks).toHaveLength(1)
  })

  it('holds no typing and fetches no icons', async () => {
    expect(await takeTyped(0)).toEqual({ text: '' })
    expect(pageFavicon('https://mail.aloft.test/')).toBeNull()
  })
})
