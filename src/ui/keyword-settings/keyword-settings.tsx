import { createSignal, For, Show } from 'solid-js'
import { i18n } from '#i18n'
import {
  type DraftError,
  draftError,
  isChanged,
  type Keyword,
  type KeywordDraft,
  keywordUrl,
  resetBuiltIns,
  saveDraft,
} from '../../core/keywords'
import { displayUrl, tileLetter } from '../../core/results'
import { Button } from '../button/button'
import { Favicon } from '../favicon/favicon'
import { Toggle } from '../toggle/toggle'
import styles from './keyword-settings.module.css'

export interface KeywordSettingsProps {
  keywords: readonly Keyword[]
  favicon: (pageUrl: string) => Promise<string | null>
  /** Saves the whole list; false when it's too big to sync, and nothing changed. */
  onChange: (keywords: Keyword[]) => Promise<boolean>
  newId?: () => string
}

type Editing = { id: string | undefined; draft: KeywordDraft }

const ERROR_TEXT: Record<DraftError | 'full', () => string> = {
  name: () => i18n.t('keywordErrorName'),
  keyword: () => i18n.t('keywordErrorKeyword'),
  'keyword-taken': () => i18n.t('keywordErrorTaken'),
  url: () => i18n.t('keywordErrorUrl'),
  full: () => i18n.t('keywordErrorFull'),
}

const EMPTY_DRAFT: KeywordDraft = { name: '', keyword: '', url: 'https://' }

const defaultId = () => `custom-${Date.now().toString(36)}`

export function KeywordSettings(props: KeywordSettingsProps) {
  const [editing, setEditing] = createSignal<Editing>()
  const [error, setError] = createSignal<DraftError | 'full'>()
  const [confirmReset, setConfirmReset] = createSignal(false)

  const edit = (keyword: Keyword | undefined) => {
    setError(undefined)
    setEditing({
      id: keyword?.id,
      draft: keyword
        ? { name: keyword.name, keyword: keyword.keyword, url: keyword.url }
        : EMPTY_DRAFT,
    })
  }
  const change = (field: keyof KeywordDraft, value: string) => {
    const current = editing()
    if (current) setEditing({ ...current, draft: { ...current.draft, [field]: value } })
  }
  const save = async (next: Keyword[]) => {
    const saved = await props.onChange(next)
    if (!saved) setError('full')
    return saved
  }
  const submit = async () => {
    const current = editing()
    if (!current) return
    const problem = draftError(props.keywords, current.draft, current.id)
    if (problem) {
      setError(problem)
      return
    }
    const next = saveDraft(props.keywords, current.draft, current.id, props.newId ?? defaultId)
    if (await save(next)) setEditing(undefined)
  }
  const remove = async (id: string) => {
    if (await save(props.keywords.filter((k) => k.id !== id))) setEditing(undefined)
  }
  const toggle = (id: string, on: boolean) =>
    void save(props.keywords.map((k) => (k.id === id ? { ...k, enabled: on } : k)))

  const form = (current: Editing) => (
    <form
      class={styles.form}
      aria-label={current.id ? i18n.t('keywordEdit', [current.draft.name]) : i18n.t('keywordAdd')}
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <label class={styles.field}>
        {i18n.t('keywordName')}
        <input
          class={styles.input}
          value={current.draft.name}
          maxLength={40}
          onInput={(event) => change('name', event.currentTarget.value)}
        />
      </label>
      <label class={styles.field}>
        {i18n.t('keywordKeyword')}
        <input
          class={styles.input}
          value={current.draft.keyword}
          maxLength={24}
          autocapitalize="off"
          spellcheck={false}
          onInput={(event) => change('keyword', event.currentTarget.value)}
        />
      </label>
      <label class={`${styles.field} ${styles.wide}`}>
        {i18n.t('keywordAddress')}
        <input
          class={styles.input}
          type="url"
          value={current.draft.url}
          maxLength={512}
          spellcheck={false}
          onInput={(event) => change('url', event.currentTarget.value)}
        />
      </label>
      <Show when={error()}>
        {(problem) => (
          <p class={`${styles.error} ${styles.wide}`} role="alert">
            {ERROR_TEXT[problem()]()}
          </p>
        )}
      </Show>
      <div class={`${styles.buttons} ${styles.wide}`}>
        <Show when={current.id && !props.keywords.find((k) => k.id === current.id)?.builtIn}>
          <button
            type="button"
            class={styles.danger}
            onClick={() => current.id && void remove(current.id)}
          >
            {i18n.t('keywordDelete')}
          </button>
        </Show>
        <span class={styles.spacer} />
        <Button onClick={() => setEditing(undefined)}>{i18n.t('keywordCancel')}</Button>
        <Button type="submit" variant="primary">
          {i18n.t('keywordSave')}
        </Button>
      </div>
    </form>
  )

  return (
    <div class={styles.list}>
      <ul class={styles.rows}>
        <For each={props.keywords}>
          {(keyword) => (
            <li class={styles.item}>
              <Show
                when={editing()?.id === keyword.id && editing()}
                fallback={
                  <div class={styles.row} data-off={!keyword.enabled || undefined}>
                    <span class={styles.icon}>
                      <Favicon
                        pageUrl={keywordUrl(keyword, '')}
                        load={props.favicon}
                        letter={tileLetter(keyword.name, keyword.url)}
                      />
                    </span>
                    <span class={styles.text}>
                      <span class={styles.name}>
                        {keyword.name}
                        <Show when={!keyword.builtIn}>
                          <span class={styles.tag}>{i18n.t('keywordYours')}</span>
                        </Show>
                      </span>
                      <span class={styles.url}>{displayUrl(keyword.url)}</span>
                    </span>
                    <kbd class={styles.word}>{keyword.keyword}</kbd>
                    <button
                      type="button"
                      class={styles.edit}
                      aria-label={i18n.t('keywordEdit', [keyword.name])}
                      onClick={() => edit(keyword)}
                    >
                      {i18n.t('keywordEditShort')}
                    </button>
                    <Toggle
                      label={i18n.t('keywordUse', [keyword.name])}
                      labelHidden
                      checked={keyword.enabled}
                      onChange={(on) => toggle(keyword.id, on)}
                    />
                  </div>
                }
              >
                {(current) => form(current())}
              </Show>
            </li>
          )}
        </For>
      </ul>
      <Show when={editing() && editing()?.id === undefined && editing()}>
        {(current) => form(current())}
      </Show>
      <div class={styles.actions}>
        <Show when={editing() === undefined}>
          <Button onClick={() => edit(undefined)}>{i18n.t('keywordAdd')}</Button>
        </Show>
        <span class={styles.spacer} />
        <Show
          when={confirmReset()}
          fallback={
            <button
              type="button"
              class={styles.danger}
              disabled={!props.keywords.some(isChanged)}
              onClick={() => setConfirmReset(true)}
            >
              {i18n.t('keywordReset')}
            </button>
          }
        >
          <span class={styles.confirm}>
            {i18n.t('keywordResetConfirm')}
            <Button onClick={() => setConfirmReset(false)}>{i18n.t('keywordCancel')}</Button>
            <Button
              variant="primary"
              onClick={() => {
                setConfirmReset(false)
                setEditing(undefined)
                void save(resetBuiltIns(props.keywords))
              }}
            >
              {i18n.t('keywordResetYes')}
            </Button>
          </span>
        </Show>
      </div>
    </div>
  )
}
