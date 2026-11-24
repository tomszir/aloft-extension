import type { ParentProps } from 'solid-js'
import styles from './kbd.module.css'

export interface KbdProps extends ParentProps {
  /** On the selected row, whose background the plain keycap blends into. */
  selected?: boolean
}

export function Kbd(props: KbdProps) {
  return (
    <kbd class={styles.kbd} data-selected={props.selected || undefined}>
      {props.children}
    </kbd>
  )
}
