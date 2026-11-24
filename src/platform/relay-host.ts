import { type Browser, browser } from 'wxt/browser'
import { type PaletteCallName, paletteCalls } from './palette-calls'
import {
  isRelayCall,
  isWatched,
  RELAY_WATCH,
  type RelayCall,
  type RelayPort,
  type RelayReply,
} from './relay'
import { onTabEvent } from './sources'
import { watchZoom } from './zoom'

// Only Aloft's own palette may ask: content scripts share runtime messaging
// but report the page's URL, never the palette's.
function fromPalette(sender: { id?: string; url?: string } | undefined): boolean {
  return (
    sender?.id === browser.runtime.id &&
    (sender.url?.startsWith(browser.runtime.getURL('/palette.html')) ?? false)
  )
}

const isCallName = (calls: object, name: string): name is PaletteCallName =>
  Object.hasOwn(calls, name)

export async function answerRelayCall(
  message: RelayCall,
  sender: Browser.runtime.MessageSender,
): Promise<RelayReply> {
  // The tab the palette is framed in: tabs.getCurrent() would answer for the
  // background, which has no tab.
  const calls = paletteCalls(async () => sender.tab)
  if (!isCallName(calls, message.name))
    return { ok: false, error: `unknown palette call ${message.name}` }
  try {
    // Arguments come from Aloft's own palette, built for this same table.
    const value: unknown = await Reflect.apply(calls[message.name], undefined, message.args)
    return { ok: true, value }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export function serveWatch(port: RelayPort): void {
  if (port.name !== RELAY_WATCH) return
  if (!fromPalette(port.sender)) {
    port.disconnect()
    return
  }
  let stop: (() => void) | undefined
  const notify = () => port.postMessage({})
  port.onMessage.addListener((message: unknown) => {
    if (stop || !isWatched(message)) return
    stop = message.kind === 'tabs' ? onTabEvent(notify) : watchZoom(message.tabId, notify)
  })
  port.onDisconnect.addListener(() => stop?.())
}

/** Answers the overlay palette's calls in Firefox; see relay.ts. */
export function serveRelay(): void {
  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    if (!isRelayCall(message) || !fromPalette(sender)) return
    void answerRelayCall(message, sender).then(sendResponse)
    return true
  })
  browser.runtime.onConnect.addListener(serveWatch)
}
