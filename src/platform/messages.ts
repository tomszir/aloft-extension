// Extension messaging, never window.postMessage: the page could see and forge
// those.
export const CLOSE_OVERLAY = 'aloft:close-overlay'

export interface CloseOverlayMessage {
  type: typeof CLOSE_OVERLAY
}

// The background passes these in so settings parsing (and its libraries) stays
// out of the script injected into pages.
export interface OverlayOptions {
  blur: boolean
}

// Lives on the content script's isolated-world global, which pages can't read.
export const OVERLAY_OPTIONS_KEY = 'aloftOverlayOptions'

export function readOverlayOptions(scope: object): OverlayOptions {
  const raw: unknown = Reflect.get(scope, OVERLAY_OPTIONS_KEY)
  const blur = typeof raw === 'object' && raw !== null && 'blur' in raw ? raw.blur === true : true
  return { blur }
}

export function isCloseOverlayMessage(message: unknown): message is CloseOverlayMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === CLOSE_OVERLAY
  )
}

// The new tab page asks this before drawing the palette, so a tab Ctrl+T is
// about to close doesn't flash it first.
export const NEW_TAB_STAYS = 'aloft:new-tab-stays'

export interface NewTabStaysMessage {
  type: typeof NEW_TAB_STAYS
}

export function isNewTabStaysMessage(message: unknown): message is NewTabStaysMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === NEW_TAB_STAYS
  )
}

// The palette asks for the keys held for it while it loaded (see holdKeys in
// overlay.ts); the overlay answers with them as text and starts over.
export const TAKE_TYPED = 'aloft:take-typed'

export interface TakeTypedMessage {
  type: typeof TAKE_TYPED
}

export function isTakeTypedMessage(message: unknown): message is TakeTypedMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === TAKE_TYPED
  )
}

/** Text typed on the page while the overlay opens, kept from the page. */
export interface HeldKeys {
  text: string
  /** Set by the overlay once it's drawn, so the hold doesn't time out under it. */
  claimed: boolean
  /** Runs after each held key. */
  onKey: (() => void) | undefined
  release: () => void
}

// On the content script's isolated-world global, like the overlay options.
export const HELD_KEYS_KEY = 'aloftHeldKeys'

export function readHeldKeys(scope: object): HeldKeys | undefined {
  const raw: unknown = Reflect.get(scope, HELD_KEYS_KEY)
  return typeof raw === 'object' &&
    raw !== null &&
    'text' in raw &&
    typeof raw.text === 'string' &&
    'release' in raw &&
    typeof raw.release === 'function'
    ? (raw as HeldKeys)
    : undefined
}
