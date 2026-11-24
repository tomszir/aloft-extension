import { browser } from 'wxt/browser'
import type { PaletteCallName, PaletteCalls } from './palette-calls'

// Firefox gives an extension page framed inside a website only content-script
// APIs (runtime, storage, i18n), so the overlay palette asks the background
// for everything else. Extension messaging, which the page can't see.
export const RELAY_CALL = 'aloft:relay-call'
export const RELAY_WATCH = 'aloft:relay-watch'

export interface RelayCall {
  type: typeof RELAY_CALL
  name: string
  args: unknown[]
}

export type RelayReply = { ok: true; value: unknown } | { ok: false; error: string }

export type Watched = { kind: 'tabs' } | { kind: 'zoom'; tabId: number }

/** The part of runtime.Port the relay uses, so tests can stand in for one. */
export interface RelayPort {
  name: string
  sender?: { id?: string; url?: string }
  postMessage(message: unknown): void
  disconnect(): void
  onMessage: { addListener(listener: (message: unknown) => void): void }
  onDisconnect: { addListener(listener: () => void): void }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export function isRelayCall(message: unknown): message is RelayCall {
  return (
    isObject(message) &&
    message.type === RELAY_CALL &&
    typeof message.name === 'string' &&
    Array.isArray(message.args)
  )
}

export function isWatched(message: unknown): message is Watched {
  if (!isObject(message)) return false
  return message.kind === 'tabs' || (message.kind === 'zoom' && typeof message.tabId === 'number')
}

function isRelayReply(reply: unknown): reply is RelayReply {
  return (
    isObject(reply) &&
    ((reply.ok === true && 'value' in reply) ||
      (reply.ok === false && typeof reply.error === 'string'))
  )
}

/** The palette call `name`, answered by the background. */
export function relayed<K extends PaletteCallName>(name: K): PaletteCalls[K] {
  const call = async (...args: unknown[]): Promise<unknown> => {
    const message: RelayCall = { type: RELAY_CALL, name, args }
    const reply: unknown = await browser.runtime.sendMessage(message)
    if (!isRelayReply(reply)) throw new Error(`Aloft's background didn't answer ${name}`)
    if (!reply.ok) throw new Error(reply.error)
    return reply.value
  }
  // The background runs the same function from the same table, so the
  // signature holds; it just can't be checked across the message boundary.
  return call as PaletteCalls[K]
}

// A port that lived this long was working, so losing it means the background
// was restarted rather than that it refuses the connection.
const HEALTHY_PORT_MS = 1000

/** Calls `onChange` whenever the background reports a change to `watched`. */
export function watchRelayed(
  watched: Watched,
  onChange: () => void,
  open: () => RelayPort = () => browser.runtime.connect({ name: RELAY_WATCH }),
): () => void {
  let stopped = false
  let port: RelayPort | undefined
  const connect = () => {
    const opened = Date.now()
    const current = open()
    port = current
    // A change already in flight when the palette stopped watching.
    current.onMessage.addListener(() => {
      if (!stopped) onChange()
    })
    current.onDisconnect.addListener(() => {
      if (stopped || Date.now() - opened < HEALTHY_PORT_MS) return
      connect()
      // Whatever changed while the port was down went unreported.
      onChange()
    })
    current.postMessage(watched)
  }
  connect()
  return () => {
    stopped = true
    port?.disconnect()
  }
}
