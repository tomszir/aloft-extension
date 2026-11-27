import { For, Show } from 'solid-js'
import { i18n } from '#i18n'
import { contrastIssues, type Theme, type ThemeColors } from '../../core/theme'
import { Button } from '../button/button'
import styles from './theme-editor.module.css'

export interface ThemeEditorProps {
  /** The theme as edited so far; the preview shows it before it's saved. */
  theme: Theme
  /** False for a theme not saved yet, which has nothing to delete. */
  saved: boolean
  /** Why saving failed, if it did. */
  error?: string | undefined
  onChange: (theme: Theme) => void
  onSave: () => void
  onCancel: () => void
  onDelete: () => void
  onExport: () => void
}

const COLORS: readonly { key: keyof ThemeColors; label: () => string }[] = [
  { key: 'panel', label: () => i18n.t('themeColorPanel') },
  { key: 'selected', label: () => i18n.t('themeColorSelected') },
  { key: 'border', label: () => i18n.t('themeColorBorder') },
  { key: 'text', label: () => i18n.t('themeColorText') },
  { key: 'muted', label: () => i18n.t('themeColorMuted') },
  { key: 'accent', label: () => i18n.t('themeColorAccent') },
]

const LABEL = Object.fromEntries(COLORS.map((c) => [c.key, c.label])) as Record<
  keyof ThemeColors,
  () => string
>

const HEX = /^#[0-9a-f]{6}$/i
const MAX_RADIUS = 24

/** Six colors and a corner radius; everything else in a theme is derived from them. */
export function ThemeEditor(props: ThemeEditorProps) {
  const setColor = (key: keyof ThemeColors, value: string) => {
    if (!HEX.test(value)) return
    props.onChange({
      ...props.theme,
      colors: { ...props.theme.colors, [key]: value.toUpperCase() },
    })
  }
  const issues = () => contrastIssues(props.theme.colors)

  return (
    <form
      class={styles.editor}
      aria-label={i18n.t('themeEditorLabel')}
      onSubmit={(event) => {
        event.preventDefault()
        props.onSave()
      }}
    >
      <label class={styles.field}>
        {i18n.t('themeName')}
        <input
          class={styles.input}
          value={props.theme.name}
          maxLength={40}
          required
          onInput={(event) => props.onChange({ ...props.theme, name: event.currentTarget.value })}
        />
      </label>

      <div class={styles.colors}>
        <For each={COLORS}>
          {(color) => (
            <div class={styles.color}>
              <input
                class={styles.swatch}
                type="color"
                value={props.theme.colors[color.key].toLowerCase()}
                aria-label={i18n.t('themeColorPick', [color.label()])}
                onInput={(event) => setColor(color.key, event.currentTarget.value)}
              />
              <label class={styles.field}>
                {color.label()}
                <input
                  class={`${styles.input} ${styles.hex}`}
                  value={props.theme.colors[color.key]}
                  maxLength={7}
                  spellcheck={false}
                  autocapitalize="off"
                  onChange={(event) => {
                    const value = event.currentTarget.value.trim()
                    const hex = value.startsWith('#') ? value : `#${value}`
                    if (HEX.test(hex)) setColor(color.key, hex)
                    else event.currentTarget.value = props.theme.colors[color.key]
                  }}
                />
              </label>
            </div>
          )}
        </For>
      </div>

      <label class={styles.field}>
        <span class={styles.radiusLabel}>
          {i18n.t('themeRadius')}
          <span>{i18n.t('themeRadiusValue', [String(props.theme.radius)])}</span>
        </span>
        <input
          class={styles.range}
          type="range"
          min={0}
          max={MAX_RADIUS}
          step={1}
          value={props.theme.radius}
          onInput={(event) =>
            props.onChange({ ...props.theme, radius: Number(event.currentTarget.value) })
          }
        />
      </label>

      <Show when={issues().length > 0}>
        <ul class={styles.issues} aria-live="polite">
          <For each={issues()}>
            {(issue) => (
              <li>
                {i18n.t('themeContrastIssue', [
                  LABEL[issue.foreground](),
                  LABEL[issue.background](),
                  issue.ratio.toFixed(1),
                ])}
              </li>
            )}
          </For>
        </ul>
      </Show>

      <Show when={props.error}>
        {(error) => (
          <p class={styles.error} role="alert">
            {error()}
          </p>
        )}
      </Show>

      <div class={styles.buttons}>
        <Button type="submit" variant="primary" disabled={props.theme.name.trim() === ''}>
          {i18n.t('themeSave')}
        </Button>
        <Button onClick={() => props.onCancel()}>{i18n.t('themeCancel')}</Button>
        <span class={styles.spacer} />
        <Button onClick={() => props.onExport()}>{i18n.t('themeExport')}</Button>
        <Show when={props.saved}>
          <Button class={styles.danger} onClick={() => props.onDelete()}>
            {i18n.t('themeDelete')}
          </Button>
        </Show>
      </div>
    </form>
  )
}
