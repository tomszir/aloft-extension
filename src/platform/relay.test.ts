import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type Browser, browser } from 'wxt/browser'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { RELAY_CALL, RELAY_WATCH, type RelayPort, relayed, watchRelayed } from './relay'
import { answerRelayCall, serveRelay, serveWatch } from './relay-host'

const PALETTE = {
  id: browser.runtime.id,
  url: `${browser.runtime.getURL('/palette.html')}?host=overlay`,
}
const HOST_TAB: Browser.tabs.Tab = {
  id: 7,
  index: 3,
  windowId: 2,
  active: true,
  highlighted: true,
  pinned: false,
  incognito: false,
  frozen: false,
  selected: true,
  discarded: false,
  autoDiscardable: true,
  groupId: -1,
  lastAccessed: 0,
}

// fakeBrowser leaves these unimplemented; none of them fire in these tests.
beforeEach(() => {
  for (const event of [
    browser.runtime.onConnect,
    browser.tabs.onMoved,
    browser.tabs.onAttached,
    browser.tabs.onDetached,
  ]) {
    vi.spyOn(event, 'addListener').mockImplementation(() => {})
    vi.spyOn(event, 'removeListener').mockImplementation(() => {})
  }
})

// What runtime.sendMessage does in Firefox: hand the message to the
// background's listeners and resolve with the reply.
function routeMessagesThroughBackground(sender: Browser.runtime.MessageSender) {
  vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(
    (message: unknown) =>
      new Promise((resolve) => {
        void fakeBrowser.runtime.onMessage.trigger(message, sender, resolve)
      }),
  )
}

describe('relay calls', () => {
  beforeEach(() => serveRelay())

  it('runs the call in the background and returns its result', async () => {
    routeMessagesThroughBackground({ ...PALETTE, tab: HOST_TAB })
    const move = vi.spyOn(browser.tabs, 'move').mockImplementation(async () => [])

    await relayed('movePinned')(11, 0)

    expect(move).toHaveBeenCalledWith(11, { index: 0 })
  })

  it('answers currentTab with the tab the palette is framed in', async () => {
    routeMessagesThroughBackground({ ...PALETTE, tab: HOST_TAB })

    expect(await relayed('currentTab')()).toEqual({ id: 7, index: 3, windowId: 2 })
  })

  it("passes the browser's error back to the palette", async () => {
    routeMessagesThroughBackground({ ...PALETTE, tab: HOST_TAB })
    vi.spyOn(browser.tabs, 'move').mockRejectedValue(new Error('No tab with id: 11'))

    await expect(relayed('movePinned')(11, 0)).rejects.toThrow('No tab with id: 11')
  })

  it('ignores messages from anything but the palette', async () => {
    const move = vi.spyOn(browser.tabs, 'move').mockImplementation(async () => [])
    const sendResponse = vi.fn()
    const message = { type: RELAY_CALL, name: 'movePinned', args: [11, 0] }
    // A content script shares runtime messaging but reports the page's URL.
    const contentScript = { id: browser.runtime.id, url: 'https://example.com/', tab: HOST_TAB }

    await fakeBrowser.runtime.onMessage.trigger(message, contentScript, sendResponse)

    expect(sendResponse).not.toHaveBeenCalled()
    expect(move).not.toHaveBeenCalled()
  })

  it('refuses names outside the palette table', async () => {
    const reply = await answerRelayCall(
      { type: RELAY_CALL, name: 'constructor', args: [] },
      { ...PALETTE, tab: HOST_TAB },
    )
    expect(reply).toEqual({ ok: false, error: 'unknown palette call constructor' })
  })
})

/** Two connected port ends, like runtime.connect gives the palette and background. */
function portPair(sender: RelayPort['sender']) {
  const listeners = () => {
    const set = new Set<(message?: unknown) => void>()
    return {
      addListener: (l: (message?: unknown) => void) => void set.add(l),
      emit: (message?: unknown) => {
        for (const l of set) l(message)
      },
    }
  }
  const sides = {
    palette: { message: listeners(), gone: listeners() },
    background: { message: listeners(), gone: listeners() },
  }
  const end = (own: typeof sides.palette, other: typeof sides.palette): RelayPort => ({
    name: RELAY_WATCH,
    sender,
    postMessage: (message) => other.message.emit(message),
    // Like a real port, the other end hears about it a moment later.
    disconnect: () => queueMicrotask(() => other.gone.emit()),
    onMessage: { addListener: own.message.addListener },
    onDisconnect: { addListener: own.gone.addListener },
  })
  return {
    palette: end(sides.palette, sides.background),
    background: end(sides.background, sides.palette),
  }
}

describe('relay watches', () => {
  afterEach(() => vi.useRealTimers())

  // Each connection the palette opens, served by the background as it would be.
  function connectToBackground(sender: RelayPort['sender'] = PALETTE) {
    const opened: ReturnType<typeof portPair>[] = []
    const open = () => {
      const pair = portPair(sender)
      opened.push(pair)
      serveWatch(pair.background)
      return pair.palette
    }
    return { open, opened }
  }

  it('reports tab changes until the palette stops watching', async () => {
    const { open } = connectToBackground()
    const onChange = vi.fn()
    const stop = watchRelayed({ kind: 'tabs' }, onChange, open)

    await fakeBrowser.tabs.onRemoved.trigger(1, { windowId: 1, isWindowClosing: false })
    expect(onChange).toHaveBeenCalledTimes(1)

    stop()
    await fakeBrowser.tabs.onRemoved.trigger(2, { windowId: 1, isWindowClosing: false })
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('reconnects and refreshes when the background restarts', async () => {
    vi.useFakeTimers()
    const { open, opened } = connectToBackground()
    const onChange = vi.fn()
    watchRelayed({ kind: 'tabs' }, onChange, open)

    vi.advanceTimersByTime(5000)
    opened[0]?.background.disconnect()
    await Promise.resolve()

    expect(opened).toHaveLength(2)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('gives up on a background that refuses the connection', async () => {
    const { open, opened } = connectToBackground({
      id: browser.runtime.id,
      url: 'https://example.com/',
    })
    const onChange = vi.fn()
    watchRelayed({ kind: 'tabs' }, onChange, open)
    await Promise.resolve()

    expect(opened).toHaveLength(1)
    expect(onChange).not.toHaveBeenCalled()
  })
})
