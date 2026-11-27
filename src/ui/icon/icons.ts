const sources = import.meta.glob<string>('./svg/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
})

/** Must match vendor/icons.lock.json; icons.test.ts checks that it does. */
export const ICON_NAMES = [
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

export type IconName = (typeof ICON_NAMES)[number]

const ROOT =
  /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">(.*)<\/svg>$/s

/**
 * The shapes inside a vendored icon. The vendor script normalises every root
 * element, so anything else means a hand-edited or foreign file.
 *
 * @throws If the icon isn't vendored or its root was changed, which is a bug.
 */
export function iconBody(name: IconName): string {
  const source = sources[`./svg/${name}.svg`]
  if (source === undefined) throw new Error(`icon "${name}" is not vendored`)
  const match = ROOT.exec(source.trim())
  if (!match) throw new Error(`icon "${name}" has an unexpected root element`)
  return match[1] ?? ''
}
