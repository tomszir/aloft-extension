import { For } from 'solid-js'
import { deriveTokens, type Theme, tokensToCssVars } from '../../core/theme'
import styles from './theme-picker.module.css'

export interface ThemePickerProps {
  label: string
  themes: readonly Theme[]
  value: string
  onChange: (themeId: string) => void
}

let nextId = 0

// Each card is drawn in its own theme's colors, so it previews itself
// whichever theme the page is in.
const swatchVars = (theme: Theme) => tokensToCssVars(deriveTokens(theme))

export function ThemePicker(props: ThemePickerProps) {
  const name = `al-theme-${nextId++}`
  return (
    <fieldset class={styles.field}>
      <legend class={styles.legend}>{props.label}</legend>
      <div class={styles.grid}>
        <For each={props.themes}>
          {(theme) => (
            <label class={styles.card} style={swatchVars(theme)}>
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
          )}
        </For>
      </div>
    </fieldset>
  )
}
