import * as v from 'valibot'

// Fonts are only ever ones already on the computer: Aloft downloads nothing.
export const FONTS = ['system', 'sans', 'serif', 'rounded', 'mono', 'custom'] as const
export type Font = (typeof FONTS)[number]

export const DENSITIES = ['compact', 'default', 'comfortable'] as const
export type Density = (typeof DENSITIES)[number]

/**
 * A font's name as the person typed it. Only letters, digits, spaces and a
 * little punctuation, so it can't close the quotes it's put in and add to
 * the CSS.
 */
export const FontName = v.pipe(
  v.string(),
  v.trim(),
  v.maxLength(60),
  v.regex(/^[\p{L}\p{N} ._-]*$/u),
)

/** Whether a typed font name can be used (see FontName). */
export const isFontName = (name: string): boolean => v.safeParse(FontName, name).success

const STACKS: Record<Exclude<Font, 'custom'>, string> = {
  system: 'system-ui, sans-serif',
  sans: '"Helvetica Neue", Arial, "Liberation Sans", "Noto Sans", sans-serif',
  serif: 'ui-serif, Georgia, "Times New Roman", "Noto Serif", serif',
  rounded: 'ui-rounded, "SF Pro Rounded", Nunito, "Varela Round", system-ui, sans-serif',
  mono: 'ui-monospace, "SF Mono", "JetBrains Mono", "Cascadia Code", Menlo, Consolas, monospace',
}

/** The CSS font-family for a choice, falling back to the system font. */
export function fontFamily(font: Font, customFont: string): string {
  if (font !== 'custom') return STACKS[font]
  const name = v.safeParse(FontName, customFont)
  return name.success && name.output !== '' ? `"${name.output}", ${STACKS.system}` : STACKS.system
}

/** The palette's sizes for a density; "default" is what tokens.css already says. */
export function densityTokens(density: Density): Record<`--al-${string}`, string> {
  switch (density) {
    case 'compact':
      return {
        '--al-font-size-sm': '11px',
        '--al-font-size-md': '13px',
        '--al-font-size-lg': '15px',
        '--al-input-height': '48px',
        '--al-row-height': '36px',
        '--al-footer-height': '34px',
        '--al-tile-height': '38px',
      }
    case 'comfortable':
      return {
        '--al-font-size-sm': '13px',
        '--al-font-size-md': '15px',
        '--al-font-size-lg': '18px',
        '--al-input-height': '62px',
        '--al-row-height': '50px',
        '--al-footer-height': '42px',
        '--al-tile-height': '48px',
      }
    default:
      return {}
  }
}
