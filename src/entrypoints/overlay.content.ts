import { browser } from 'wxt/browser'
import { createIframeUi } from '#imports'
import { isCloseOverlayMessage, readOverlayOptions } from '../platform/messages'

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
    const closeExisting = scope[OPEN]
    if (closeExisting) {
      closeExisting()
      return
    }

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
          opacity: reduceMotion ? '1' : '0',
          transition: reduceMotion ? 'none' : 'opacity 120ms ease-out',
        })
      },
      onMount(_wrapper, iframe) {
        requestAnimationFrame(() => {
          iframe.style.opacity = '1'
        })
        iframe.focus()
      },
    })

    const onMessage = (message: unknown) => {
      if (isCloseOverlayMessage(message)) close()
    }

    function close() {
      browser.runtime.onMessage.removeListener(onMessage)
      ui.remove()
      host.remove()
      delete scope[OPEN]
      if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true })
    }

    browser.runtime.onMessage.addListener(onMessage)
    scope[OPEN] = close
    document.documentElement.append(host)
    dialog.showModal()
    ui.mount()
  },
})
