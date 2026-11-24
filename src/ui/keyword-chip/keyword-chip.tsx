import { createResource } from 'solid-js'
import { brandColor } from '../../core/color'
import { type Keyword, keywordUrl } from '../../core/keywords'
import { tileLetter } from '../../core/results'
import { Favicon, type FaviconLoader } from '../favicon/favicon'
import styles from './keyword-chip.module.css'

const SAMPLE_SIZE = 32

/**
 * The icon's colour, read from a canvas. Favicons come from the extension's
 * own origin, so the canvas isn't tainted; anything that fails just means no
 * colour, and the chip keeps the theme's accent.
 */
export async function iconColor(src: string): Promise<string | null> {
  try {
    const image = new Image()
    image.src = src
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = SAMPLE_SIZE
    canvas.height = SAMPLE_SIZE
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return null
    context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
    return brandColor(context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data)
  } catch {
    return null
  }
}

export interface KeywordChipProps {
  keyword: Keyword
  favicon: FaviconLoader
  color?: (src: string) => Promise<string | null>
}

/** The chip in front of the input while a keyword is in use, in its site's colour. */
export function KeywordChip(props: KeywordChipProps) {
  const site = () => keywordUrl(props.keyword, '')
  const [color] = createResource(site, async (pageUrl) => {
    const src = await props.favicon(pageUrl)
    return src ? ((await (props.color ?? iconColor)(src)) ?? undefined) : undefined
  })
  return (
    <span
      class={styles.chip}
      data-colored={color() ? true : undefined}
      style={color() ? { '--al-chip-color': color() } : undefined}
    >
      <Favicon
        pageUrl={site()}
        load={props.favicon}
        letter={tileLetter(props.keyword.name, props.keyword.url)}
      />
      {props.keyword.name}
    </span>
  )
}
