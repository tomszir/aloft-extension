import { createMemo } from 'solid-js'
import styles from './icon.module.css'
import { type IconName, iconBody } from './icons'

/** Decorative: whatever control it sits in carries the accessible name. */
export function Icon(props: { name: IconName }) {
  const body = createMemo(() => iconBody(props.name))
  return (
    <svg
      class={styles.icon}
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      // Our own vendored, checksum-pinned files, checked by iconBody: never
      // user or page content.
      innerHTML={body()}
    />
  )
}
