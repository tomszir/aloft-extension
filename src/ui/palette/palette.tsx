import { createMemo, createSignal, onCleanup, onMount, Show } from 'solid-js'
import { i18n } from '#i18n'
import { shortcutSlot } from '../../core/pinned'
import type { Chip } from '../../core/query'
import type { Result, Section, SectionId, TabEntry } from '../../core/results'
import { Icon } from '../icon/icon'
import { Kbd } from '../kbd/kbd'
import { Keyed } from '../keyed/keyed'
import { PinnedRow } from '../pinned-row/pinned-row'
import { ResultRow } from '../result-row/result-row'
import { TileMenu } from '../tile-menu/tile-menu'
import styles from './palette.module.css'

export type PalettePosition = 'upper-third' | 'center'
export type Move = 'next' | 'previous' | 'first' | 'last'

export interface PaletteProps {
  position: PalettePosition
  query: string
  chip: Chip | null
  sections: readonly Section[]
  activeId: string | undefined
  /** Resolves to null when the browser has no icon for the page. */
  favicon: (pageUrl: string) => Promise<string | null>
  onQuery: (text: string) => void
  /** Backspace on an empty input or Esc while a chip is shown. */
  onLeaveChip: () => void
  onMove: (move: Move) => void
  onHover: (resultId: string) => void
  onActivate: (result: Result, shift: boolean) => void
  onClose: () => void
  /** Off in the settings preview, so loading the page doesn't move focus into it. */
  autofocus?: boolean
  /** Off where Enter always opens in place, so the hints would be wrong. */
  showOpenHints?: boolean
  /** Shown as a row; empty hides it. */
  pins: readonly TabEntry[]
  /** Alt+1–9 targets, which also work while a query hides the row. */
  pinShortcuts: readonly TabEntry[]
  onOpenPin: (pin: TabEntry) => void
  onMovePin: (pin: TabEntry, direction: 'left' | 'right') => void
  /** Moves a dragged pin to a position in the row. Without it, pins can't be dragged. */
  onReorderPin?: (pin: TabEntry, position: number) => void
  onUnpin: (pin: TabEntry) => void
}

const RESULTS_ID = 'al-results'

const SECTION_LABEL: Record<SectionId, (() => string) | undefined> = {
  top: undefined,
  tabs: () => i18n.t('sectionOpenTabs'),
  history: () => i18n.t('sectionHistory'),
  bookmarks: () => i18n.t('sectionBookmarks'),
  closed: () => i18n.t('sectionRecentlyClosed'),
  actions: () => i18n.t('sectionActions'),
}

const MOVES: Record<string, Move> = {
  ArrowDown: 'next',
  ArrowUp: 'previous',
  PageDown: 'last',
  PageUp: 'first',
}

export function Palette(props: PaletteProps) {
  let input: HTMLInputElement | undefined
  onMount(() => {
    if (props.autofocus ?? true) input?.focus()
  })

  // aria-activedescendant needs stable, valid ids; result ids contain URLs.
  const optionIds = createMemo(() => {
    const ids = new Map<string, string>()
    for (const section of props.sections) {
      for (const result of section.results) ids.set(result.id, `al-option-${ids.size}`)
    }
    return ids
  })
  const placeholder = () =>
    props.chip === 'actions' ? i18n.t('placeholderActions') : i18n.t('palettePlaceholder')
  const activeResult = createMemo(() =>
    props.sections.flatMap((s) => s.results).find((r) => r.id === props.activeId),
  )

  // Number badges appear only while Alt is held, like the browser's own
  // access-key hints, so the row stays calm the rest of the time.
  const [altHeld, setAltHeld] = createSignal(false)
  const trackAlt = (event: KeyboardEvent) => setAltHeld(event.altKey)
  const releaseAlt = () => setAltHeld(false)
  window.addEventListener('keydown', trackAlt)
  window.addEventListener('keyup', trackAlt)
  window.addEventListener('blur', releaseAlt)
  onCleanup(() => {
    window.removeEventListener('keydown', trackAlt)
    window.removeEventListener('keyup', trackAlt)
    window.removeEventListener('blur', releaseAlt)
  })

  const [menu, setMenu] = createSignal<{ pin: TabEntry; x: number; y: number }>()
  const closeMenu = () => {
    setMenu(undefined)
    input?.focus()
  }
  const menuItems = (pin: TabEntry) => {
    const position = props.pins.findIndex((p) => p.tabId === pin.tabId)
    return [
      { label: i18n.t('menuOpen'), run: () => props.onOpenPin(pin) },
      {
        label: i18n.t('menuMoveLeft'),
        disabled: position <= 0,
        run: () => props.onMovePin(pin, 'left'),
      },
      {
        label: i18n.t('menuMoveRight'),
        disabled: position === -1 || position >= props.pins.length - 1,
        run: () => props.onMovePin(pin, 'right'),
      },
      { label: i18n.t('menuUnpin'), danger: true, run: () => props.onUnpin(pin) },
    ]
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.altKey && !event.ctrlKey && !event.metaKey) {
      const slot = shortcutSlot(event.code)
      const pin = slot === undefined ? undefined : props.pinShortcuts[slot]
      if (pin) {
        event.preventDefault()
        props.onOpenPin(pin)
        return
      }
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      if (props.chip) props.onLeaveChip()
      else props.onClose()
      return
    }
    // Result keys belong to the search box; on a focused tile, Enter is the
    // tile's own click.
    if (event.target !== input) return
    if (event.key === 'Backspace' && props.chip && input.value === '') {
      event.preventDefault()
      props.onLeaveChip()
      return
    }
    const move = MOVES[event.key]
    if (move) {
      event.preventDefault()
      props.onMove(move)
    } else if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault()
      const result = activeResult()
      if (result) props.onActivate(result, event.shiftKey)
    }
  }

  return (
    <div class={styles.layout} data-position={props.position}>
      {/* Mouse-only way out; keyboard users have Esc, so it stays out of the tab order. */}
      <button
        type="button"
        class={styles.backdrop}
        tabIndex={-1}
        aria-label={i18n.t('hintClose')}
        onClick={() => props.onClose()}
      />
      <div
        class={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={i18n.t('paletteLabel')}
        onKeyDown={onKeyDown}
      >
        <div class={styles.inputRow}>
          {/* The icon shows the mode; the chip only names it. */}
          <span class={styles.searchIcon} data-mode={props.chip ?? 'search'}>
            <Icon name={props.chip === 'actions' ? 'terminal' : 'search'} />
          </span>
          <Show when={props.chip === 'actions'}>
            <span class={styles.modeChip}>{i18n.t('sectionActions')}</span>
          </Show>
          <input
            ref={input}
            class={styles.input}
            type="text"
            role="combobox"
            aria-expanded={props.sections.length > 0}
            aria-controls={RESULTS_ID}
            aria-autocomplete="list"
            aria-activedescendant={props.activeId ? optionIds().get(props.activeId) : undefined}
            autocomplete="off"
            spellcheck={false}
            placeholder={placeholder()}
            aria-label={placeholder()}
            value={props.query}
            onInput={(event) => props.onQuery(event.currentTarget.value)}
          />
        </div>
        <Show when={props.pins.length > 0}>
          <PinnedRow
            pins={props.pins}
            altHeld={altHeld()}
            favicon={props.favicon}
            onOpen={(pin) => props.onOpenPin(pin)}
            onMenu={(pin, anchor) => setMenu({ pin, x: anchor.left, y: anchor.bottom + 4 })}
            onReorder={props.onReorderPin}
          />
        </Show>
        <div
          id={RESULTS_ID}
          class={styles.results}
          role="listbox"
          aria-label={i18n.t('resultsLabel')}
        >
          <Keyed each={props.sections} by={(section) => section.id}>
            {(section) => (
              // biome-ignore lint/a11y/useSemanticElements: a <fieldset> isn't allowed inside a listbox; role="group" is the ARIA pattern for grouped options.
              <div class={styles.section} role="group" aria-label={SECTION_LABEL[section().id]?.()}>
                <Show when={SECTION_LABEL[section().id]}>
                  {(label) => (
                    <div class={styles.sectionLabel} aria-hidden="true">
                      {label()()}
                    </div>
                  )}
                </Show>
                <Keyed each={section().results} by={(result) => result.id}>
                  {(result) => (
                    <ResultRow
                      result={result()}
                      optionId={optionIds().get(result().id) ?? ''}
                      active={result().id === props.activeId}
                      favicon={props.favicon}
                      onHover={() => props.onHover(result().id)}
                      onActivate={(shift) => props.onActivate(result(), shift)}
                    />
                  )}
                </Keyed>
              </div>
            )}
          </Keyed>
        </div>
        <footer class={styles.footer}>
          <span class={styles.hint}>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> {i18n.t('hintNavigate')}
          </span>
          <Show
            when={props.chip === 'actions'}
            fallback={
              <>
                <Show when={props.showOpenHints ?? true}>
                  <span class={styles.hint}>
                    <Kbd>↵</Kbd> {i18n.t('hintNewTab')}
                  </span>
                  <span class={styles.hint}>
                    <Kbd>⇧ ↵</Kbd> {i18n.t('hintCurrentTab')}
                  </span>
                </Show>
                <span class={`${styles.hint} ${styles.hintEnd}`}>
                  <Kbd>&gt;</Kbd> {i18n.t('hintActions')}
                </span>
                <span class={styles.hint}>
                  <Kbd>Esc</Kbd> {i18n.t('hintClose')}
                </span>
              </>
            }
          >
            <span class={styles.hint}>
              <Kbd>↵</Kbd> {i18n.t('hintRun')}
            </span>
            <span class={`${styles.hint} ${styles.hintEnd}`}>
              <Kbd>Esc</Kbd> {i18n.t('hintBack')}
            </span>
          </Show>
        </footer>
      </div>
      {/* Outside the panel, which clips overflow, so the menu can extend past it. */}
      <Show when={menu()}>
        {(open) => (
          <TileMenu
            label={i18n.t('pinnedMenuLabel', [open().pin.title])}
            x={open().x}
            y={open().y}
            items={menuItems(open().pin)}
            onClose={closeMenu}
          />
        )}
      </Show>
    </div>
  )
}
