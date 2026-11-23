import { Show } from 'solid-js'
import { i18n } from '#i18n'
import type { ActionId } from '../../core/actions'
import { displayUrl, type Result } from '../../core/results'
import { Favicon } from '../favicon/favicon'
import { Icon } from '../icon/icon'
import type { IconName } from '../icon/icons'
import { Kbd } from '../kbd/kbd'
import styles from './result-row.module.css'

export interface ResultRowProps {
  result: Result
  optionId: string
  active: boolean
  favicon: (pageUrl: string) => string
  onHover: () => void
  onActivate: (shift: boolean) => void
}

function title(result: Result): string {
  switch (result.kind) {
    case 'search':
      return result.query
    case 'url':
      return displayUrl(result.url)
    default:
      return result.title
  }
}

function subtitle(result: Result): string {
  switch (result.kind) {
    case 'search':
      return i18n.t('searchTheWeb')
    case 'url':
      return i18n.t('goToAddress')
    case 'action':
      return result.hint
    default:
      return displayUrl(result.url)
  }
}

function action(result: Result): string {
  switch (result.kind) {
    case 'search':
      return i18n.t('actionSearch')
    case 'tab':
      return i18n.t('actionSwitch')
    case 'closed':
      return i18n.t('actionRestore')
    case 'action':
      return i18n.t('actionRun')
    default:
      return i18n.t('actionOpen')
  }
}

const ACTION_ICON: Record<ActionId, IconName> = {
  pin: 'pin',
  unpin: 'pin-off',
  duplicate: 'copy',
  'new-window': 'app-window',
  'move-to-new-window': 'square-arrow-out-up-right',
  'close-other-tabs': 'copy-x',
  'reopen-closed-tab': 'undo-2',
}

/** Undefined for page results, which show the site's favicon instead. */
function glyph(result: Result): IconName | undefined {
  switch (result.kind) {
    case 'search':
      return 'search'
    case 'url':
      return 'globe'
    case 'action':
      return ACTION_ICON[result.action]
    default:
      return undefined
  }
}

export function ResultRow(props: ResultRowProps) {
  const pageUrl = () => ('url' in props.result ? props.result.url : '')
  return (
    // Focus stays in the input (aria-activedescendant points here), so the
    // row is reachable by keyboard without being a tab stop itself.
    // biome-ignore lint/a11y/useKeyWithClickEvents: the combobox input handles the keys for every option.
    <div
      id={props.optionId}
      class={styles.row}
      role="option"
      tabIndex={-1}
      aria-selected={props.active}
      data-active={props.active || undefined}
      // mousemove rather than mouseenter: rows re-render under a still cursor
      // while typing, and that must not steal the keyboard selection.
      onMouseMove={() => {
        if (!props.active) props.onHover()
      }}
      // Clicking must not pull focus out of the input.
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => props.onActivate(event.shiftKey)}
    >
      <Show
        when={glyph(props.result)}
        fallback={
          <Favicon src={props.favicon(pageUrl())} fallback={title(props.result).charAt(0)} />
        }
      >
        {(name) => (
          <span class={styles.glyph}>
            <Icon name={name()} />
          </span>
        )}
      </Show>
      <span class={styles.text}>
        <span class={styles.title}>{title(props.result)}</span>
        <span class={styles.subtitle}>{subtitle(props.result)}</span>
      </span>
      <Show when={props.active}>
        <span class={styles.action}>
          {action(props.result)} <Kbd>↵</Kbd>
        </span>
      </Show>
    </div>
  )
}
