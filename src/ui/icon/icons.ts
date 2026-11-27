// Split in two so the palette, which has a size budget, only bundles the
// icons it draws. Pages that draw the others import page-icons.ts, which adds
// them. Both lists together must match vendor/icons.lock.json; icons.test.ts
// checks that they do.

/** Drawn in the palette, so bundled with it. */
export const PALETTE_ICON_NAMES = [
  'app-window',
  'copy',
  'copy-x',
  'globe',
  'pin',
  'pin-off',
  'plus',
  'search',
  'settings',
  'square-arrow-out-up-right',
  'terminal',
  'undo-2',
] as const

/** Only on Aloft's own pages (settings, onboarding); added by page-icons.ts. */
export const PAGE_ICON_NAMES = [
  'arrow-left',
  'at-sign',
  'check',
  'download',
  'external-link',
  'keyboard',
  'layers',
  'list',
  'monitor',
  'moon',
  'palette',
  'pencil',
  'sparkles',
  'sun',
  'trash-2',
  'upload',
  'x',
] as const

export const ICON_NAMES = [...PALETTE_ICON_NAMES, ...PAGE_ICON_NAMES]

export type IconName = (typeof PALETTE_ICON_NAMES)[number] | (typeof PAGE_ICON_NAMES)[number]

const loaded = new Map<string, string>()

/** Makes vendored icons drawable, keyed by their path under ./svg/. */
export function addIcons(sources: Record<string, string>): void {
  for (const [path, source] of Object.entries(sources)) loaded.set(path, source)
}

addIcons(
  import.meta.glob<string>(
    [
      './svg/app-window.svg',
      './svg/copy.svg',
      './svg/copy-x.svg',
      './svg/globe.svg',
      './svg/pin.svg',
      './svg/pin-off.svg',
      './svg/plus.svg',
      './svg/search.svg',
      './svg/settings.svg',
      './svg/square-arrow-out-up-right.svg',
      './svg/terminal.svg',
      './svg/undo-2.svg',
      './svg/x.svg',
    ],
    { query: '?raw', import: 'default', eager: true },
  ),
)

const ROOT =
  /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">(.*)<\/svg>$/s

/**
 * The shapes inside a vendored icon. The vendor script normalises every root
 * element, so anything else means a hand-edited or foreign file.
 *
 * @throws If the icon isn't vendored, isn't loaded on this page, or its root
 *   was changed, which is a bug.
 */
export function iconBody(name: IconName): string {
  const source = loaded.get(`./svg/${name}.svg`)
  if (source === undefined) throw new Error(`icon "${name}" is not vendored or not loaded here`)
  const match = ROOT.exec(source.trim())
  if (!match) throw new Error(`icon "${name}" has an unexpected root element`)
  return match[1] ?? ''
}
