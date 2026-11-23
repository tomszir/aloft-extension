import type { ParentProps } from 'solid-js'
import styles from './kbd.module.css'

export function Kbd(props: ParentProps) {
  return <kbd class={styles.kbd}>{props.children}</kbd>
}
