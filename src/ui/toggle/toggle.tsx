import { type JSX, Show } from 'solid-js'
import styles from './toggle.module.css'

export interface ToggleProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  /**
   * Shown under the label, and read out as the switch's description. Text
   * only: the whole row is the switch's label, so a button here would flip it.
   */
  note?: JSX.Element
  /** For a switch whose row already shows what it's for: the label is only read out. */
  labelHidden?: boolean
}

let nextId = 0

/**
 * A switch whose whole row is pressable, like a button: the text on the left,
 * never running under the switch, which stays centered on the right.
 */
export function Toggle(props: ToggleProps) {
  const id = nextId++
  const labelId = `al-toggle-label-${id}`
  const noteId = `al-toggle-note-${id}`
  return (
    <label class={styles.row} data-plain={props.labelHidden || undefined}>
      <span class={styles.text}>
        <span id={labelId} class={props.labelHidden ? styles.hidden : styles.label}>
          {props.label}
        </span>
        <Show when={props.note}>
          <span id={noteId} class={styles.note}>
            {props.note}
          </span>
        </Show>
      </span>
      <input
        class={styles.switch}
        type="checkbox"
        role="switch"
        checked={props.checked}
        aria-checked={props.checked}
        // Named by the label alone; the note, inside the same row, describes it.
        aria-labelledby={labelId}
        aria-describedby={props.note ? noteId : undefined}
        onChange={(event) => props.onChange(event.currentTarget.checked)}
      />
    </label>
  )
}
