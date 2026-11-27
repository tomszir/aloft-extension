import { type JSX, Show } from 'solid-js'
import styles from './toggle.module.css'

export interface ToggleProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  /**
   * Shown under the label, and read out as the switch's description. Text
   * only: it's part of what flips the switch.
   */
  note?: JSX.Element
  /** Drawn before the text, such as a site's icon. */
  leading?: JSX.Element
  /** A control of its own beside the switch, such as Edit; it doesn't flip the switch. */
  action?: JSX.Element
  /** Shown faded, for something switched off that is still listed. */
  muted?: boolean
}

let nextId = 0

/**
 * A switch whose whole row is pressable, like a button: the text on the left,
 * never running under the switch, which stays centered on the right.
 */
export function Toggle(props: ToggleProps) {
  const id = nextId++
  const inputId = `al-toggle-${id}`
  const labelId = `al-toggle-label-${id}`
  const noteId = `al-toggle-note-${id}`
  return (
    <div class={styles.row} data-muted={props.muted || undefined}>
      {/* The label covers the text, so pressing anywhere on it flips the
          switch, and leaves room for an action that mustn't. */}
      <label for={inputId} class={styles.hit}>
        <Show when={props.leading}>
          <span class={styles.leading}>{props.leading}</span>
        </Show>
        <span class={styles.text}>
          <span id={labelId} class={styles.label}>
            {props.label}
          </span>
          <Show when={props.note}>
            <span id={noteId} class={styles.note}>
              {props.note}
            </span>
          </Show>
        </span>
      </label>
      {props.action}
      <input
        id={inputId}
        class={styles.switch}
        type="checkbox"
        role="switch"
        checked={props.checked}
        aria-checked={props.checked}
        // Named by the label alone; the note describes it.
        aria-labelledby={labelId}
        aria-describedby={props.note ? noteId : undefined}
        onChange={(event) => props.onChange(event.currentTarget.checked)}
      />
    </div>
  )
}
