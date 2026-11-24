import { type JSX, Show } from 'solid-js'
import styles from './toggle.module.css'

export interface ToggleProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  /** Shown under the label, and read out as the switch's description. */
  note?: JSX.Element
  /** For a switch whose row already shows what it's for: the label is only read out. */
  labelHidden?: boolean
}

let nextId = 0

export function Toggle(props: ToggleProps) {
  const noteId = `al-toggle-note-${nextId++}`
  return (
    <div class={styles.field}>
      <label class={styles.row}>
        <span class={props.labelHidden ? styles.hidden : styles.label}>{props.label}</span>
        <input
          class={styles.switch}
          type="checkbox"
          role="switch"
          checked={props.checked}
          aria-checked={props.checked}
          aria-describedby={props.note ? noteId : undefined}
          onChange={(event) => props.onChange(event.currentTarget.checked)}
        />
      </label>
      <Show when={props.note}>
        <div id={noteId} class={styles.note}>
          {props.note}
        </div>
      </Show>
    </div>
  )
}
