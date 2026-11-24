import { createResource, createSignal, Match, Switch } from 'solid-js'
import { type IconTone, iconTone } from '../../core/icon-tone'
import styles from './favicon.module.css'

const SAMPLE_SIZE = 16

/**
 * Reads a loaded icon's pixels. Favicons come from the extension's own origin,
 * so the canvas isn't tainted; if reading fails anyway, the icon just keeps
 * the usual tile.
 */
export function readTone(image: HTMLImageElement): IconTone | undefined {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = SAMPLE_SIZE
    canvas.height = SAMPLE_SIZE
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return undefined
    context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
    return iconTone(context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data)
  } catch {
    return undefined
  }
}

/**
 * The icon's address, or null when the browser has none for the page. An
 * answer already known comes back as a plain value, so a row that mounts again
 * while typing shows its icon straight away instead of an empty tile first.
 */
export type FaviconLoader = (pageUrl: string) => string | null | Promise<string | null>

// Rows remount as results change; remembering each icon's tone keeps a dark
// icon's backing from flicking off and on again.
const tones = new Map<string, IconTone | undefined>()

export interface FaviconProps {
  pageUrl: string
  load: FaviconLoader
  letter: string
  tone?: (image: HTMLImageElement) => IconTone | undefined
}

export function Favicon(props: FaviconProps) {
  // A tuple, because createResource skips its fetcher for a falsy source.
  const [src] = createResource(
    () => [props.pageUrl] as const,
    ([pageUrl]) => props.load(pageUrl),
  )
  const [failed, setFailed] = createSignal(false)
  const [tone, setTone] = createSignal<IconTone | undefined>()
  return (
    // Stays empty while the icon is checked, so a real icon never flashes a
    // letter first.
    // An all-black icon like ChatGPT's would vanish on a dark tile, and an
    // all-white one on a light tile, so those get a backing they show up on.
    <span
      class={styles.tile}
      data-tone={tone() ?? (src.state === 'ready' ? tones.get(src() ?? '') : undefined)}
      aria-hidden="true"
    >
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
              onLoad={(event) => {
                const read = (props.tone ?? readTone)(event.currentTarget)
                tones.set(icon(), read)
                setTone(read)
              }}
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
