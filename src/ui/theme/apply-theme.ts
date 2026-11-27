import type { Settings } from '../../core/settings'
import { deriveTokens, PAGE_COLORS, type Theme, tokensToCssVars } from '../../core/theme'
import { densityTokens, fontFamily } from '../../core/typography'

const SCHEME_EXTRAS = {
  dark: {
    '--al-scrim': 'rgba(0, 0, 0, 0.45)',
    '--al-page': PAGE_COLORS.dark,
    '--al-danger': '#F2A8A0',
    '--al-shadow': '0 24px 64px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.35)',
    '--al-lift-shadow': '0 10px 24px rgba(0, 0, 0, 0.45), 0 2px 6px rgba(0, 0, 0, 0.35)',
  },
  light: {
    '--al-scrim': 'rgba(20, 24, 24, 0.22)',
    '--al-page': PAGE_COLORS.light,
    '--al-danger': '#B42318',
    '--al-shadow': '0 24px 64px rgba(20, 24, 24, 0.18), 0 2px 8px rgba(20, 24, 24, 0.08)',
    '--al-lift-shadow': '0 10px 24px rgba(20, 24, 24, 0.18), 0 2px 6px rgba(20, 24, 24, 0.1)',
  },
} as const

export function applyTheme(root: HTMLElement, theme: Theme): void {
  const tokens = deriveTokens(theme)
  const vars = { ...tokensToCssVars(tokens), ...SCHEME_EXTRAS[tokens.scheme] }
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value)
  root.dataset.scheme = tokens.scheme
}

const DENSITY_NAMES = Object.keys(densityTokens('compact'))

/** The font everywhere, and the density only where `density` says (the palette). */
export function applyTypography(
  root: HTMLElement,
  appearance: Settings['appearance'],
  density: boolean,
): void {
  root.style.setProperty('--al-font-family', fontFamily(appearance.font, appearance.customFont))
  // Cleared first, so going back to the default leaves tokens.css in charge.
  for (const name of DENSITY_NAMES) root.style.removeProperty(name)
  if (!density) return
  for (const [name, value] of Object.entries(densityTokens(appearance.density))) {
    root.style.setProperty(name, value)
  }
}
