import { createEffect, For, on, Show } from 'solid-js'
import { Icon } from '../icon/icon'
import type { IconName } from '../icon/icons'
import { slideHighlight } from '../motion/slide'
import styles from './choice.module.css'

export interface ChoiceOption<T extends string> {
  value: T
  label: string
  /** Drawn before the label, for options that are easier to tell apart at a glance. */
  icon?: IconName
}

export interface ChoiceProps<T extends string> {
  /** Shown as the group's legend, unless `labelledBy` names it instead. */
  label: string
  /** The id of a visible label elsewhere, such as a settings row's; then there's no legend. */
  labelledBy?: string
  options: readonly ChoiceOption<T>[]
  value: T
  onChange: (value: T) => void
  note?: string
}

let nextId = 0

/** A row of mutually exclusive options; native radios, so arrow keys move between them. */
export function Choice<T extends string>(props: ChoiceProps<T>) {
  const name = `al-choice-${nextId++}`
  // The selected option's highlight slides over from the one picked before,
  // like a tab indicator, instead of jumping.
  let options: HTMLDivElement | undefined
  let picked: Element | undefined
  createEffect(
    on(
      () => props.value,
      () => {
        const now = options?.querySelector(`[data-value="${CSS.escape(props.value)}"]`) ?? undefined
        if (picked?.isConnected && now) slideHighlight(picked, now, '--al-duration-move')
        picked = now
      },
    ),
  )
  return (
    <fieldset class={styles.field} aria-labelledby={props.labelledBy}>
      <Show when={!props.labelledBy}>
        <legend class={styles.legend}>{props.label}</legend>
      </Show>
      <div ref={options} class={styles.options}>
        <For each={props.options}>
          {(option) => (
            <label class={styles.option} data-value={option.value}>
              <input
                class={styles.radio}
                type="radio"
                name={name}
                value={option.value}
                checked={props.value === option.value}
                onChange={() => props.onChange(option.value)}
              />
              <Show when={option.icon}>{(name) => <Icon name={name()} />}</Show>
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
