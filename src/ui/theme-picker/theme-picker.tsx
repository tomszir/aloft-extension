import { For, Show } from 'solid-js'
import { i18n } from '#i18n'
import { deriveTokens, type Theme, tokensToCssVars } from '../../core/theme'
import { Icon } from '../icon/icon'
import styles from './theme-picker.module.css'

export interface ThemePickerProps {
  label: string
  /** The id of a visible label elsewhere, such as a settings row's; then there's no legend. */
  labelledBy?: string
  themes: readonly Theme[]
  value: string
  onChange: (themeId: string) => void
  /** Ids of the person's own themes, which get an edit button. */
  customIds?: ReadonlySet<string>
  onEdit?: (theme: Theme) => void
  /** Starts a new theme from the selected one; without it there's no "New theme" card. */
  onNew?: () => void
}

let nextId = 0

// Each card is drawn in its own theme's colors, so it previews itself
// whichever theme the page is in.
const swatchVars = (theme: Theme) => tokensToCssVars(deriveTokens(theme))

export function ThemePicker(props: ThemePickerProps) {
  const name = `al-theme-${nextId++}`
  const isCustom = (theme: Theme) => props.customIds?.has(theme.id) ?? false
  return (
    <fieldset class={styles.field} aria-labelledby={props.labelledBy}>
      <Show when={!props.labelledBy}>
        <legend class={styles.legend}>{props.label}</legend>
      </Show>
      <div class={styles.grid}>
        <For each={props.themes}>
          {(theme) => (
            <div class={styles.slot} style={swatchVars(theme)}>
              <label class={styles.card}>
                <input
                  class={styles.radio}
                  type="radio"
                  name={name}
                  value={theme.id}
                  checked={props.value === theme.id}
                  onChange={() => props.onChange(theme.id)}
                />
                <span class={styles.sample} aria-hidden="true">
                  <span class={styles.bar} />
                  <span class={styles.row} />
                  <span class={styles.accent} />
                </span>
                <span class={styles.name}>{theme.name}</span>
              </label>
              {/* Beside the card, not in it: a button inside a label would also select it. */}
              <Show when={isCustom(theme) && props.onEdit}>
                {(edit) => (
                  <button
                    type="button"
                    class={styles.edit}
                    onClick={() => edit()(theme)}
                    aria-label={i18n.t('themeEditNamed', [theme.name])}
                  >
                    {i18n.t('themeEditShort')}
                  </button>
                )}
              </Show>
            </div>
          )}
        </For>
        <Show when={props.onNew}>
          {(onNew) => (
            <button type="button" class={styles.new} onClick={() => onNew()()}>
              <Icon name="plus" />
              {i18n.t('themeNew')}
            </button>
          )}
        </Show>
      </div>
    </fieldset>
  )
}
