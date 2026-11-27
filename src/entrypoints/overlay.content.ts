import { browser } from 'wxt/browser'
import { createIframeUi } from '#imports'
import {
  type HeldTyping,
  isCloseOverlayMessage,
  isTakeTypedMessage,
  readHeldKeys,
  readOverlayOptions,
} from '../platform/messages'

// Only an iframe goes into the page: anything Aloft drew in the page's own DOM
// (tab titles, history) could be read by the page's scripts. Keep this file
// small, since it's injected into every page Aloft opens on.

// Each injection runs main() again, so pressing the shortcut twice closes.
const OPEN = Symbol.for('aloft.overlay')
// Long past when any palette asks for the keys it was held, even one slow to
// read its settings: focusing before it has drawn its input would lose keys.
const FOCUS_FALLBACK_MS = 3000
type Scope = typeof globalThis & { [OPEN]?: () => void }

// The dialog only lifts the frame into the top layer; the palette draws its own
// dimming, so the dialog itself and its backdrop stay invisible.
const SHADOW_CSS = `
:host { all: initial; }
dialog {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  overflow: visible;
}
dialog::backdrop { background: transparent; }
`

export default defineContentScript({
  matches: [],
  registration: 'runtime',
  main(ctx) {
    const scope = globalThis as Scope
    // Keys typed since the shortcut, kept from the page (see prepareInPage).
    const held = readHeldKeys(scope)
    const closeExisting = scope[OPEN]
    if (closeExisting) {
      held?.release()
      closeExisting()
      return
    }
    if (held) held.claimed = true

    const { blur } = readOverlayOptions(scope)
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
    const previousFocus = document.activeElement

    // A page's modal <dialog> or popover sits in the top layer, above any
    // z-index, and a modal dialog makes everything outside it inert. Opening
    // Aloft as a modal dialog of its own puts it on top of both and makes the
    // page inert instead. The shadow root keeps the page's CSS for
    // dialog and iframe elements off it, and is closed so the page can't
    // reach in for the frame's address: in Firefox it holds an id fixed for
    // the install, which any site could read to recognise the person. The
    // e2e build leaves it open, because Playwright can only find the frame
    // through an open root.
    const host = document.createElement('aloft-overlay')
    const shadow = host.attachShadow({ mode: import.meta.env.MODE === 'e2e' ? 'open' : 'closed' })
    const style = document.createElement('style')
    style.textContent = SHADOW_CSS
    const dialog = document.createElement('dialog')
    // Esc only reaches this document when focus has left the frame; close the
    // same way the palette does, so focus is restored.
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault()
      close()
    })
    shadow.append(style, dialog)

    const ui = createIframeUi(ctx, {
      page: '/palette.html',
      position: 'modal',
      zIndex: 2147483647,
      anchor: dialog,
      onBeforeMount(_wrapper, iframe) {
        iframe.title = 'Aloft'
        Object.assign(iframe.style, {
          width: '100%',
          height: '100%',
          margin: '0',
          padding: '0',
          border: '0',
          display: 'block',
          background: 'transparent',
          // Must equal palette.html's own color-scheme, or Chrome paints an
          // opaque backdrop behind the frame. It's also where the frame's
          // prefers-color-scheme comes from, so it can't be "normal", which
          // follows the site's declaration instead of the system's preference.
          colorScheme: 'light dark',
          // Blur has to be set out here: a filter inside the frame can't
          // reach the page behind it.
          backdropFilter: blur ? 'blur(4px)' : 'none',
          opacity: '0',
          transition: reduceMotion ? 'none' : 'opacity 120ms ease-out',
        })
      },
      onMount(_wrapper, iframe) {
        iframe.addEventListener(
          'load',
          () => {
            if (closing) return
            // Shown only now: until the palette has loaded, the frame holds an
            // empty document that Chrome may paint opaque white.
            iframe.style.opacity = '1'
            // The palette asks for the held keys once its search box exists,
            // which is when focus moves in; this only covers a palette that
            // never asks.
            setTimeout(() => focusFrame(iframe), FOCUS_FALLBACK_MS)
          },
          { once: true },
        )
      },
    })

    // Keys sent into the frame before the palette has drawn its search box are
    // lost, even after the frame has loaded (it reads settings first), so they
    // stay out here, held, until it asks for them. A key that reaches the
    // page after that means focus left the frame: it's held too, and the
    // palette asks for it as focus comes back.
    let frame: HTMLIFrameElement | undefined
    function focusFrame(iframe: HTMLIFrameElement) {
      frame = iframe
      if (!closing) iframe.focus()
    }
    if (held)
      held.onKey = () => {
        if (frame) focusFrame(frame)
      }

    const onMessage = (
      message: unknown,
      _sender: unknown,
      sendResponse: (reply: unknown) => void,
    ) => {
      if (isCloseOverlayMessage(message)) close()
      else if (isTakeTypedMessage(message)) {
        const typing: HeldTyping = { text: held?.text ?? '', submit: held?.submit }
        sendResponse(typing)
        if (held) {
          held.text = ''
          held.submit = undefined
        }
        const iframe = shadow.querySelector('iframe')
        if (iframe && shadow.activeElement !== iframe) focusFrame(iframe)
      }
    }

    let closing = false
    function close() {
      if (closing) return
      closing = true
      held?.release()
      browser.runtime.onMessage.removeListener(onMessage)
      delete scope[OPEN]
      const remove = () => {
        ui.remove()
        host.remove()
      }
      // The page gets focus back as the fade starts, so typing straight after
      // Esc lands there. A modal dialog keeps the page inert, so the frame
      // fades in a plain, inert one instead, which clicks pass through.
      const iframe = shadow.querySelector('iframe')
      const fade = !reduceMotion && iframe !== null
      dialog.inert = true
      dialog.close()
      if (fade) {
        dialog.show()
        Object.assign(iframe.style, {
          pointerEvents: 'none',
          // Quicker than opening: closing should never feel like waiting.
          transition: 'opacity 80ms ease-in',
          opacity: '0',
        })
        // transitionend doesn't fire in a background tab, which a result
        // opened in a new tab leaves this one as.
        setTimeout(remove, 100)
      } else {
        remove()
      }
      // After show(), which would otherwise take focus back into the dialog.
      if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true })
    }

    browser.runtime.onMessage.addListener(onMessage)
    scope[OPEN] = close
    document.documentElement.append(host)
    dialog.showModal()
    ui.mount()
  },
})
