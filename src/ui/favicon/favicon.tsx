import { createResource, createSignal, Match, Switch } from 'solid-js'
import styles from './favicon.module.css'

export interface FaviconProps {
  pageUrl: string
  /** Resolves to the icon's address, or null when the browser has none for the page. */
  load: (pageUrl: string) => Promise<string | null>
  letter: string
}

export function Favicon(props: FaviconProps) {
  // A tuple, because createResource skips its fetcher for a falsy source.
  const [src] = createResource(
    () => [props.pageUrl] as const,
    ([pageUrl]) => props.load(pageUrl),
  )
  const [failed, setFailed] = createSignal(false)
  return (
    // Stays empty while the icon is checked, so a real icon never flashes a
    // letter first.
    <span class={styles.tile} aria-hidden="true">
      <Switch>
        <Match when={src.state === 'ready' && !failed() && src()}>
          {(icon) => (
            <img
              class={styles.image}
              src={icon()}
              alt=""
              width="16"
              height="16"
              draggable={false}
              onError={() => setFailed(true)}
            />
          )}
        </Match>
        <Match when={src.state === 'ready' || src.state === 'errored' || failed()}>
          <span class={styles.letter} data-testid="favicon-letter">
            {props.letter}
          </span>
        </Match>
      </Switch>
    </span>
  )
}
