import { type JSX, Show } from 'solid-js'
import styles from './setting-row.module.css'

export interface SettingRowProps {
  label: string
  /** For the control to be named by, through aria-labelledby. */
  labelId?: string
  description?: JSX.Element
  /** For the control to be described by, through aria-describedby. */
  descriptionId?: string
  /** Wide controls (theme cards, lists) go under the text instead of beside it. */
  stacked?: boolean
  children: JSX.Element
}

/** One setting: what it is on the left, its control on the right, as in grouped lists. */
export function SettingRow(props: SettingRowProps) {
  return (
    <div class={styles.row} data-stacked={props.stacked || undefined}>
      <div class={styles.text}>
        <span id={props.labelId} class={styles.label}>
          {props.label}
        </span>
        <Show when={props.description}>
          <div id={props.descriptionId} class={styles.description}>
            {props.description}
          </div>
        </Show>
      </div>
      <div class={styles.control}>{props.children}</div>
    </div>
  )
}
