import { createEffect, createMemo, createSignal, onCleanup, Show } from 'solid-js'
import { i18n } from '#i18n'
import { heldOrder, MAX_SHORTCUTS, reorder } from '../../core/pinned'
import { type TabEntry, tileLetter } from '../../core/results'
import { Favicon, type FaviconLoader } from '../favicon/favicon'
import { Kbd } from '../kbd/kbd'
import { Keyed } from '../keyed/keyed'
import { createPinDrag } from './drag'
import styles from './pinned-row.module.css'

export interface PinnedRowProps {
  pins: readonly TabEntry[]
  altHeld: boolean
  favicon: FaviconLoader
  onOpen: (pin: TabEntry) => void
  onMenu: (pin: TabEntry, anchor: DOMRect) => void
  /** Called with the pin's new position in the row. Without it, pins can't be dragged. */
  onReorder?: (pin: TabEntry, position: number) => void
}

/** How long a dropped order is shown if the browser never reports the move. */
const HOLD_TIMEOUT = 2000

export function PinnedRow(props: PinnedRowProps) {
  let grid: HTMLDivElement | undefined
  const [held, setHeld] = createSignal<readonly number[]>()
  const shown = createMemo(() => {
    const order = held()
    return (order && heldOrder(props.pins, order)) ?? props.pins
  })
  let holdTimer: ReturnType<typeof setTimeout> | undefined
  createEffect(() => {
    const order = held()
    if (order && !heldOrder(props.pins, order)) setHeld(undefined)
  })
  onCleanup(() => clearTimeout(holdTimer))

  const drag = createPinDrag({
    grid: () => grid,
    ids: () => shown().map((pin) => pin.tabId),
    onDrop: (tabId, from, to) => {
      const pin = shown()[from]
      if (!pin || pin.tabId !== tabId) return
      setHeld(reorder(shown(), from, to).map((p) => p.tabId))
      clearTimeout(holdTimer)
      holdTimer = setTimeout(() => setHeld(undefined), HOLD_TIMEOUT)
      props.onReorder?.(pin, to)
    },
  })
  // A drop the browser hasn't confirmed yet is measured against the old row,
  // so the next drag waits for it.
  const canDrag = () => props.onReorder !== undefined && held() === undefined

  return (
    <section class={styles.row} aria-labelledby="al-pinned-label">
      <div class={styles.header}>
        <span id="al-pinned-label" class={styles.label}>
          {i18n.t('pinnedLabel')}
        </span>
        <span class={styles.hint} aria-hidden="true">
          <Kbd>Alt</Kbd>
          {i18n.t('pinnedHint')}
        </span>
      </div>
      <div ref={grid} class={styles.grid} data-dragging={drag.dragging() || undefined}>
        <Show when={drag.slot()}>
          {(cell) => (
            <span
              class={styles.slot}
              aria-hidden="true"
              style={{
                width: `${cell().width}px`,
                height: `${cell().height}px`,
                transform: `translate(${cell().x}px, ${cell().y}px)`,
              }}
            />
          )}
        </Show>
        <Keyed each={shown()} by={(pin) => pin.tabId}>
          {(pin, index) => {
            const slot = () => (index() < MAX_SHORTCUTS ? String(index() + 1) : undefined)
            const openMenu = (target: HTMLElement) =>
              props.onMenu(pin(), target.getBoundingClientRect())
            return (
              <button
                type="button"
                class={styles.pin}
                data-asleep={!pin().loaded || undefined}
                data-lifted={drag.lifted(pin().tabId) || undefined}
                data-settling={drag.settling(pin().tabId) || undefined}
                style={{ transform: drag.offset(pin().tabId, index()) }}
                aria-label={pin().title}
                aria-keyshortcuts={slot() ? `Alt+${slot()}` : undefined}
                // Also the accessible description, so screen readers hear that
                // a pin is asleep.
                title={pin().loaded ? pin().title : i18n.t('pinnedAsleepTitle', [pin().title])}
                onClick={() => {
                  if (!drag.consumeClick()) props.onOpen(pin())
                }}
                onPointerDown={(event) => {
                  if (canDrag()) drag.onPointerDown(event, pin().tabId, index())
                }}
                onPointerMove={(event) => drag.onPointerMove(event)}
                onPointerUp={(event) => drag.onPointerUp(event)}
                onPointerCancel={(event) => drag.onPointerCancel(event)}
                onLostPointerCapture={(event) => drag.onPointerCancel(event)}
                onTransitionEnd={(event) => drag.onSettled(event)}
                onContextMenu={(event) => {
                  event.preventDefault()
                  openMenu(event.currentTarget)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
                    event.preventDefault()
                    openMenu(event.currentTarget)
                  }
                }}
              >
                <span class={styles.tile} data-pin-tile>
                  <span class={styles.icon}>
                    <Favicon
                      pageUrl={pin().url}
                      load={props.favicon}
                      letter={tileLetter(pin().title, pin().url)}
                    />
                  </span>
                  <Show when={props.altHeld && slot()}>
                    {(n) => (
                      <span class={styles.badge} aria-hidden="true">
                        {n()}
                      </span>
                    )}
                  </Show>
                </span>
                <span class={styles.name} aria-hidden="true">
                  {pin().title}
                </span>
              </button>
            )
          }}
        </Keyed>
      </div>
    </section>
  )
}
