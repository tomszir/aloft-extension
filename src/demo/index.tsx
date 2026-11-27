import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { DEFAULT_SETTINGS, type Settings } from '../core/settings'
import { resolveTheme } from '../core/theme'
import { isFontName } from '../core/typography'
import { App } from '../entrypoints/palette/app'
import { focusKeys } from './focus'
import { INSTRUMENT_DARK, INSTRUMENT_LIGHT, INSTRUMENT_THEMES, TOUR_THEMES } from './instrument'
import { currentTab } from './platform/palette-api'
import { saveSettings } from './platform/settings'
import { DemoSession, type DemoSignal, setSession } from './session'
import './shell.css'
import { Tour } from './tour/tour'
import { DEMO_VERSION } from './version'

export type Scheme = 'light' | 'dark' | 'system'

export interface DemoOptions {
  /** The page's colour scheme; "system" follows prefers-color-scheme. Defaults to "system". */
  scheme?: Scheme
  /** Starts the guided tour the first time the demo opens. */
  tour?: boolean
  /**
   * A font family name for the bar, which must already be loaded on the page.
   * Defaults to the first family in the page's --font-sans, else the system font.
   */
  font?: string
  /** Something the extension would have done that leaves the page: "Would switch to …". */
  onWould?: (what: string) => void
  /** The bar closed (Esc, or a click outside it) and has faded out. */
  onClose?: () => void
  /** The tour reached its end and Finish was pressed. */
  onFinish?: () => void
}

export interface DemoHandle {
  open(): void
  close(): void
  /** Starts the tour over, on a fresh set of tabs; opens the demo if it's closed. */
  startTour(): void
  setScheme(scheme: Scheme): void
  /** Closes it, removes its shadow content and forgets its state. */
  destroy(): void
}

export const version = DEMO_VERSION

// Replaced by the build with the bundle's CSS (scripts/demo-plugins.ts).
const CSS = '__ALOFT_DEMO_CSS__'

const SHELL_CLASS = 'shell'
const FADE_MS = 200

function pageFont(): string {
  const stack = getComputedStyle(document.documentElement).getPropertyValue('--font-sans')
  const first =
    stack
      .split(',')[0]
      ?.trim()
      .replace(/^["']|["']$/g, '') ?? ''
  return isFontName(first) ? first : ''
}

function initialSettings(scheme: Scheme, font: string): Settings {
  return {
    ...DEFAULT_SETTINGS,
    // Nothing for the visitor to be told about: it's the first time they see it.
    whatsNewInAloft: false,
    appearance: {
      ...DEFAULT_SETTINGS.appearance,
      colorScheme: scheme,
      lightTheme: INSTRUMENT_LIGHT.id,
      darkTheme: INSTRUMENT_DARK.id,
      font: font === '' ? 'system' : 'custom',
      customFont: font,
    },
  }
}

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const touchScreen = () => matchMedia('(pointer: coarse)').matches

/**
 * Mounts the web demo of Aloft's palette in `host`'s shadow root: the real
 * palette over an invented browser in memory, with an optional guided tour.
 * Nothing is drawn, and nothing listens to the page, until open().
 */
export function mountDemo(host: HTMLElement, options: DemoOptions = {}): DemoHandle {
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' })
  const sheet = new CSSStyleSheet()
  sheet.replaceSync(CSS)
  shadow.adoptedStyleSheets = [sheet]

  const shell = document.createElement('div')
  shell.className = SHELL_CLASS
  shell.hidden = true
  const paletteMount = document.createElement('div')
  paletteMount.className = 'palette'
  const tourMount = document.createElement('div')
  tourMount.className = 'tour'
  shell.append(paletteMount, tourMount)
  shadow.replaceChildren(shell)

  const signalListeners = new Set<(signal: DemoSignal) => void>()
  let isOpen = false
  let tourState: 'none' | 'running' | 'over' = 'none'
  let disposePalette: (() => void) | undefined
  let disposeTour: (() => void) | undefined
  let stopWatching: (() => void) | undefined
  let returnFocus: Element | null = null
  let fade: ReturnType<typeof setTimeout> | undefined

  const session = new DemoSession(
    initialSettings(options.scheme ?? 'system', options.font ?? pageFont()),
    INSTRUMENT_THEMES,
    {
      would: (what) => options.onWould?.(what),
      dismiss: () => close(),
      // After the palette's own close has finished with it.
      reopen: () =>
        queueMicrotask(() => {
          if (isOpen) renderPalette()
        }),
      signal: (signal) => {
        for (const listener of [...signalListeners]) listener(signal)
      },
    },
  )
  session.root = shell
  setSession(session)

  const input = () => paletteMount.querySelector<HTMLInputElement>('input[role="combobox"]')
  const focusInput = () => input()?.focus()

  function renderPalette(): void {
    disposePalette?.()
    paletteMount.replaceChildren()
    setSession(session)
    disposePalette = render(
      () => (
        <App
          host="overlay"
          hostTab={currentTab()}
          settings={session.settings.get()}
          customThemes={session.themes.get()}
        />
      ),
      paletteMount,
    )
  }

  const [prefersDark, setPrefersDark] = createSignal(false)
  const [themeId, setThemeId] = createSignal('')
  const updateThemeId = () =>
    setThemeId(resolveTheme(session.settings.get().appearance, prefersDark(), TOUR_THEMES).id)

  function chooseTheme(id: string): void {
    const theme = TOUR_THEMES.find((t) => t.id === id)
    if (!theme) return
    const current = session.settings.get()
    void saveSettings({
      ...current,
      appearance: {
        ...current.appearance,
        colorScheme: theme.scheme,
        [theme.scheme === 'dark' ? 'darkTheme' : 'lightTheme']: theme.id,
      },
    })
  }

  function renderTour(): void {
    disposeTour?.()
    tourMount.replaceChildren()
    disposeTour = render(
      () => (
        <Tour
          subscribe={(listener) => {
            signalListeners.add(listener)
            return () => signalListeners.delete(listener)
          }}
          touch={touchScreen()}
          themes={TOUR_THEMES}
          themeId={themeId()}
          onTheme={chooseTheme}
          onRefocus={focusInput}
          onSkip={() => endTour()}
          onFinish={() => {
            endTour()
            options.onFinish?.()
          }}
          onEscape={() => close()}
        />
      ),
      tourMount,
    )
  }

  function endTour(): void {
    tourState = 'over'
    disposeTour?.()
    disposeTour = undefined
    tourMount.replaceChildren()
    shell.style.removeProperty('--al-demo-tour-height')
    focusInput()
  }

  // Shift+Tab from the search box reaches the tour's controls, and Tab past
  // them comes back, so both stay in one loop while the demo is open.
  const onFocusKey = focusKeys({
    shadow,
    panel: () => paletteMount.querySelector('[role="dialog"]'),
    tour: () => tourMount.firstElementChild,
    input,
  })

  // The keyword step is done when a chip shows in the search box; only the
  // palette's own markup says so.
  function watchPalette(): () => void {
    const observer = new MutationObserver(() => {
      if (paletteMount.querySelector('[data-mode="keyword"]'))
        session.hooks.signal({ kind: 'keyword' })
    })
    observer.observe(paletteMount, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-mode'],
    })
    const scheme = matchMedia('(prefers-color-scheme: dark)')
    const onScheme = () => {
      setPrefersDark(scheme.matches)
      updateThemeId()
    }
    onScheme()
    scheme.addEventListener('change', onScheme)
    const stopSettings = session.settings.watch(updateThemeId)
    const resize = new ResizeObserver(() => {
      const height = tourMount.firstElementChild ? tourMount.offsetHeight : 0
      shell.style.setProperty('--al-demo-tour-height', `${height}px`)
    })
    resize.observe(tourMount)
    shadow.addEventListener('keydown', onFocusKey, true)
    return () => {
      observer.disconnect()
      scheme.removeEventListener('change', onScheme)
      stopSettings()
      resize.disconnect()
      shadow.removeEventListener('keydown', onFocusKey, true)
    }
  }

  function open(): void {
    if (isOpen) return
    isOpen = true
    clearTimeout(fade)
    returnFocus = document.activeElement
    shell.removeAttribute('data-closing')
    shell.hidden = false
    stopWatching = watchPalette()
    renderPalette()
    if (options.tour && tourState === 'none') tourState = 'running'
    if (tourState === 'running') renderTour()
  }

  function close(): void {
    if (!isOpen) return
    isOpen = false
    stopWatching?.()
    stopWatching = undefined
    shell.setAttribute('data-closing', '')
    const finish = () => {
      // The tour keeps its step; opening again carries on from there.
      disposePalette?.()
      disposePalette = undefined
      disposeTour?.()
      disposeTour = undefined
      paletteMount.replaceChildren()
      tourMount.replaceChildren()
      shell.hidden = true
      shell.removeAttribute('data-closing')
      if (returnFocus instanceof HTMLElement && returnFocus.isConnected) returnFocus.focus()
      returnFocus = null
      options.onClose?.()
    }
    if (reducedMotion()) finish()
    else fade = setTimeout(finish, FADE_MS)
  }

  return {
    open,
    close,
    startTour() {
      session.reset()
      tourState = 'running'
      if (!isOpen) {
        open()
        return
      }
      renderPalette()
      renderTour()
    },
    setScheme(scheme) {
      const current = session.settings.get()
      session.settings.set({
        ...current,
        appearance: { ...current.appearance, colorScheme: scheme },
      })
    },
    destroy() {
      clearTimeout(fade)
      if (isOpen) {
        isOpen = false
        stopWatching?.()
      }
      disposePalette?.()
      disposeTour?.()
      shadow.replaceChildren()
      shadow.adoptedStyleSheets = []
      signalListeners.clear()
      setSession(undefined)
    },
  }
}
