import { createSignal, Show } from 'solid-js'
import styles from './favicon.module.css'

export interface FaviconProps {
  src: string
  /** First letter shown when the browser has no icon for the page. */
  fallback: string
}

export function Favicon(props: FaviconProps) {
  const [failed, setFailed] = createSignal(false)
  return (
    <span class={styles.tile} aria-hidden="true">
      <Show when={!failed()} fallback={<span class={styles.letter}>{props.fallback}</span>}>
        <img
          class={styles.image}
          src={props.src}
          alt=""
          width="16"
          height="16"
          draggable={false}
          onError={() => setFailed(true)}
        />
      </Show>
    </span>
  )
}
