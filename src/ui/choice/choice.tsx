import { For, Show } from 'solid-js'
import styles from './choice.module.css'

export interface ChoiceOption<T extends string> {
  value: T
  label: string
}

export interface ChoiceProps<T extends string> {
  label: string
  options: readonly ChoiceOption<T>[]
  value: T
  onChange: (value: T) => void
  note?: string
}

let nextId = 0

/** A row of mutually exclusive options; native radios, so arrow keys move between them. */
export function Choice<T extends string>(props: ChoiceProps<T>) {
  const name = `al-choice-${nextId++}`
  return (
    <fieldset class={styles.field}>
      <legend class={styles.legend}>{props.label}</legend>
      <div class={styles.options}>
        <For each={props.options}>
          {(option) => (
            <label class={styles.option}>
              <input
                class={styles.radio}
                type="radio"
                name={name}
                value={option.value}
                checked={props.value === option.value}
                onChange={() => props.onChange(option.value)}
              />
              {option.label}
            </label>
          )}
        </For>
      </div>
      <Show when={props.note}>
        <p class={styles.note}>{props.note}</p>
      </Show>
    </fieldset>
  )
}
