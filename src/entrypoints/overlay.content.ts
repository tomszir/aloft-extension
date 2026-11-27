import { browser } from 'wxt/browser'
import { createIframeUi } from '#imports'
import {
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
    // dialog and iframe elements off it.
    const host = document.createElement('aloft-overlay')
    const shadow = host.attachShadow({ mode: 'open' })
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
            frame = iframe
            if (closing) return
            // Shown only now: until the palette has loaded, the frame holds an
            // empty document that Chrome may paint opaque white. On Ctrl+T this
            // runs in a background tab, where a fade can't start early anyway.
            iframe.style.opacity = '1'
            // Keys sent into a frame that is still loading are lost, so they
            // stay out here, held, until the palette is there to ask for them.
            iframe.focus()
          },
          { once: true },
        )
      },
    })

    // Set once the palette has loaded. A key that reaches the page after that
    // means focus left the frame: it's held, and the palette asks for it as
    // focus comes back.
    let frame: HTMLIFrameElement | undefined
    if (held)
      held.onKey = () => {
        if (!closing) frame?.focus()
      }

    const onMessage = (
      message: unknown,
      _sender: unknown,
      sendResponse: (reply: unknown) => void,
    ) => {
      if (isCloseOverlayMessage(message)) close()
      else if (isTakeTypedMessage(message)) {
        sendResponse(held?.text ?? '')
        if (held) held.text = ''
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
