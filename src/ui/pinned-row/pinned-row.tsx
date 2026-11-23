import { Show } from 'solid-js'
import { i18n } from '#i18n'
import { MAX_SHORTCUTS } from '../../core/pinned'
import type { TabEntry } from '../../core/results'
import { Favicon } from '../favicon/favicon'
import { Kbd } from '../kbd/kbd'
import { Keyed } from '../keyed/keyed'
import styles from './pinned-row.module.css'

export interface PinnedRowProps {
  pins: readonly TabEntry[]
  altHeld: boolean
  favicon: (pageUrl: string) => string
  onOpen: (pin: TabEntry) => void
  onMenu: (pin: TabEntry, anchor: DOMRect) => void
}

export function PinnedRow(props: PinnedRowProps) {
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
      <div class={styles.grid}>
        <Keyed each={props.pins} by={(pin) => pin.tabId}>
          {(pin, index) => {
            const slot = () => (index() < MAX_SHORTCUTS ? String(index() + 1) : undefined)
            const openMenu = (target: HTMLElement) =>
              props.onMenu(pin(), target.getBoundingClientRect())
            return (
              <button
                type="button"
                class={styles.tile}
                data-loaded={pin().loaded || undefined}
                aria-label={pin().title}
                aria-keyshortcuts={slot() ? `Alt+${slot()}` : undefined}
                title={pin().title}
                onClick={() => props.onOpen(pin())}
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
                <Favicon src={props.favicon(pin().url)} fallback={pin().title.charAt(0)} />
                <Show when={pin().loaded}>
                  <span class={styles.loaded} aria-hidden="true" />
                </Show>
                <Show when={props.altHeld && slot()}>
                  {(n) => (
                    <span class={styles.badge} aria-hidden="true">
                      {n()}
                    </span>
                  )}
                </Show>
              </button>
            )
          }}
        </Keyed>
      </div>
    </section>
  )
}
