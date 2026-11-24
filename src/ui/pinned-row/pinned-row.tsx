import { Show } from 'solid-js'
import { i18n } from '#i18n'
import { MAX_SHORTCUTS } from '../../core/pinned'
import { type TabEntry, tileLetter } from '../../core/results'
import { Favicon } from '../favicon/favicon'
import { Kbd } from '../kbd/kbd'
import { Keyed } from '../keyed/keyed'
import styles from './pinned-row.module.css'

export interface PinnedRowProps {
  pins: readonly TabEntry[]
  altHeld: boolean
  favicon: (pageUrl: string) => Promise<string | null>
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
                class={styles.pin}
                data-asleep={!pin().loaded || undefined}
                aria-label={pin().title}
                aria-keyshortcuts={slot() ? `Alt+${slot()}` : undefined}
                // Also the accessible description, so screen readers hear that
                // a pin is asleep.
                title={pin().loaded ? pin().title : i18n.t('pinnedAsleepTitle', [pin().title])}
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
                <span class={styles.tile}>
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
