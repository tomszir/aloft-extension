import { createEffect, For, Match, Show, Switch } from 'solid-js'
import { i18n } from '#i18n'
import type { ActionId } from '../../core/actions'
import { type Keyword, keywordUrl } from '../../core/keywords'
import { displayUrl, type Highlight, type Result, tileLetter } from '../../core/results'
import type { Settings } from '../../core/settings'
import { Favicon, type FaviconLoader } from '../favicon/favicon'
import { Icon } from '../icon/icon'
import type { IconName } from '../icon/icons'
import { Kbd } from '../kbd/kbd'
import styles from './result-row.module.css'

export interface ResultRowProps {
  result: Result
  optionId: string
  active: boolean
  favicon: FaviconLoader
  /** Where Enter opens a page; unset where it always opens in place, so there's no choice to show. */
  enterOpensIn?: Settings['enterOpensIn']
  onHover: () => void
  onActivate: (shift: boolean) => void
  /** Closes an open tab's page; unset where nothing may be closed, or for other rows. */
  onClose?: () => void
  /** An open tab in a window other than the one Aloft is open in. */
  otherWindow?: boolean
}

const verb = (keyword: Keyword) =>
  keyword.kind === 'ask'
    ? i18n.t('keywordAsk', [keyword.name])
    : i18n.t('keywordSearch', [keyword.name])

function title(result: Result): string {
  switch (result.kind) {
    case 'search':
      return result.query
    case 'url':
      return displayUrl(result.url)
    case 'keyword':
      return verb(result.keyword)
    case 'site':
      return result.query === '' ? i18n.t('keywordOpen', [result.keyword.name]) : result.query
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
    case 'keyword':
      // A listed row names its keyword at the end, so the subtitle has room for the site.
      return result.listed ? displayUrl(result.url) : i18n.t('keywordOfferHint')
    case 'site':
      return result.query === '' ? displayUrl(result.url) : verb(result.keyword)
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
    case 'keyword':
      return i18n.t('actionChoose')
    case 'site':
      if (result.query === '') return i18n.t('actionOpen')
      return result.keyword.kind === 'ask' ? i18n.t('actionAsk') : i18n.t('actionSearch')
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

// Pages, where Shift+Enter opens the other way; tabs and closed tabs only switch or restore.
const OPENS_PAGE = new Set<Result['kind']>(['search', 'url', 'site', 'history', 'bookmark'])

const PLACE_LABEL = {
  'new-tab': () => i18n.t('openNewTab'),
  'current-tab': () => i18n.t('openHere'),
} as const

const ACTION_ICON: Record<ActionId, IconName> = {
  pin: 'pin',
  unpin: 'pin-off',
  duplicate: 'copy',
  'new-tab': 'plus',
  'new-window': 'app-window',
  'move-to-new-window': 'square-arrow-out-up-right',
  'close-other-tabs': 'copy-x',
  'reopen-closed-tab': 'undo-2',
  'open-settings': 'settings',
}

type Segment = { text: string; matched: boolean }

function segments(text: string, highlights: readonly Highlight[] = []): Segment[] {
  const parts: Segment[] = []
  let at = 0
  for (const [start, end] of highlights) {
    if (start > at) parts.push({ text: text.slice(at, start), matched: false })
    parts.push({ text: text.slice(start, end), matched: true })
    at = end
  }
  if (at < text.length) parts.push({ text: text.slice(at), matched: false })
  return parts
}

// A keyword's rows show its site, so their tile takes the site's letter, not
// the "Search…" or typed text in the title.
const letterSource = (result: Result) =>
  result.kind === 'keyword' || result.kind === 'site' ? result.keyword.name : title(result)

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

// By hand rather than scrollIntoView, which would also scroll the page
// around the overlay's frame.
function keepInView(row: HTMLElement) {
  const box = row.parentElement
  if (!box || box.scrollHeight <= box.clientHeight) return
  const rowRect = row.getBoundingClientRect()
  const boxRect = box.getBoundingClientRect()
  // The section's label sticks to the top, so a row just under it is hidden.
  const label = box.firstElementChild
  const covered =
    label && label.getAttribute('role') !== 'option' ? label.getBoundingClientRect().height : 0
  const top = boxRect.top + covered
  if (rowRect.top < top) box.scrollTop -= top - rowRect.top
  else if (rowRect.bottom > boxRect.bottom) box.scrollTop += rowRect.bottom - boxRect.bottom
}

export function ResultRow(props: ResultRowProps) {
  // A site row's address changes with every key typed; its icon is the site's.
  const pageUrl = () =>
    props.result.kind === 'site'
      ? keywordUrl(props.result.keyword, '')
      : 'url' in props.result
        ? props.result.url
        : ''
  let row: HTMLDivElement | undefined
  createEffect(() => {
    if (props.active && row) keepInView(row)
  })
  return (
    // Focus stays in the input (aria-activedescendant points here), so the
    // row is reachable by keyboard without being a tab stop itself.
    // biome-ignore lint/a11y/useKeyWithClickEvents: the combobox input handles the keys for every option.
    <div
      ref={row}
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
          <Favicon
            pageUrl={pageUrl()}
            load={props.favicon}
            letter={tileLetter(letterSource(props.result), pageUrl())}
          />
        }
      >
        {(name) => (
          <span class={styles.glyph}>
            <Icon name={name()} />
          </span>
        )}
      </Show>
      <span class={styles.text}>
        <span class={styles.title}>
          <For
            each={segments(
              title(props.result),
              'highlights' in props.result ? props.result.highlights : undefined,
            )}
          >
            {(part) => (part.matched ? <mark class={styles.match}>{part.text}</mark> : part.text)}
          </For>
        </span>
        <span class={styles.subtitle}>
          {subtitle(props.result)}
          <Show when={props.otherWindow}>
            <span class={styles.tag}>{i18n.t('resultOtherWindow')}</span>
          </Show>
        </span>
      </span>
      <Switch>
        <Match
          when={props.result.kind === 'keyword' && props.result.listed && props.result.keyword}
        >
          {(keyword) => (
            <span class={styles.action}>
              <Kbd selected={props.active}>{keyword().keyword}</Kbd>
              {/* Always there, only shown when selected, so the keywords stay in one column. */}
              <span class={styles.enter} data-shown={props.active || undefined}>
                <Kbd selected>↵</Kbd>
              </span>
            </span>
          )}
        </Match>
        <Match when={props.active && OPENS_PAGE.has(props.result.kind) && props.enterOpensIn}>
          {(place) => (
            <span class={styles.action}>
              <span class={styles.choice}>
                {PLACE_LABEL[place()]()} <Kbd selected>↵</Kbd>
              </span>
              <span class={styles.choice}>
                {PLACE_LABEL[place() === 'new-tab' ? 'current-tab' : 'new-tab']()}{' '}
                <Kbd selected>⇧ ↵</Kbd>
              </span>
            </span>
          )}
        </Match>
        <Match when={props.active && props.onClose}>
          {(close) => (
            <span class={styles.action}>
              <span class={styles.choice}>
                {action(props.result)} <Kbd selected>↵</Kbd>
              </span>
              {/* The hint is also the mouse's way to close. Hidden from
                  screen readers, which have Delete, and an option can't
                  hold a control of its own. */}
              <button
                type="button"
                class={`${styles.choice} ${styles.close}`}
                tabIndex={-1}
                aria-hidden="true"
                onMouseDown={(event) => event.preventDefault()}
                onClick={(event) => {
                  event.stopPropagation()
                  close()()
                }}
              >
                {i18n.t('actionClose')} <Kbd selected>Del</Kbd>
              </button>
            </span>
          )}
        </Match>
        <Match when={props.active}>
          <span class={styles.action}>
            {action(props.result)} <Kbd selected>↵</Kbd>
          </span>
        </Match>
      </Switch>
    </div>
  )
}
