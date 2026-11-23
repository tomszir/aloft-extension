import { browser } from 'wxt/browser'
import { createIframeUi } from '#imports'
import { isCloseOverlayMessage, readOverlayOptions } from '../platform/messages'

// Only an iframe goes into the page: anything Aloft drew in the page's own DOM
// (tab titles, history) could be read by the page's scripts. Keep this file
// small, since it's injected into every page Aloft opens on.

// Each injection runs main() again, so pressing the shortcut twice closes.
const OPEN = Symbol.for('aloft.overlay')
type Scope = typeof globalThis & { [OPEN]?: () => void }

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

    const ui = createIframeUi(ctx, {
      page: '/palette.html',
      position: 'modal',
      zIndex: 2147483647,
      anchor: document.documentElement,
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
          // A matching color-scheme keeps the frame transparent; a mismatch
          // makes Chrome paint an opaque backdrop behind it.
          colorScheme: 'normal',
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
      delete scope[OPEN]
      if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true })
    }

    browser.runtime.onMessage.addListener(onMessage)
    scope[OPEN] = close
    ui.mount()
  },
})
