import { type Accessor, createEffect, createSignal, onCleanup } from 'solid-js'
import type { Settings } from '../core/settings'
import { PRESET_THEMES, resolveTheme, type Theme } from '../core/theme'
import { applyTheme, applyTypography } from '../ui/theme/apply-theme'

/** What the settings preview is asked to show, from its address. */
export interface PreviewOverride {
  scheme?: 'light' | 'dark' | undefined
  /** A theme being edited, shown before it's saved. */
  theme?: Theme | undefined
}

export interface ThemeOptions {
  root?: HTMLElement
  customThemes?: Accessor<readonly Theme[]>
  preview?: Accessor<PreviewOverride>
  /** Only the palette takes the density; settings pages keep their sizes. */
  density?: boolean
}

export function useTheme(settings: Accessor<Settings>, options: ThemeOptions = {}): void {
  const root = options.root ?? document.documentElement
  const query = matchMedia('(prefers-color-scheme: dark)')
  const [prefersDark, setPrefersDark] = createSignal(query.matches)
  const onChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches)
  query.addEventListener('change', onChange)
  onCleanup(() => query.removeEventListener('change', onChange))
  createEffect(() => {
    const { appearance } = settings()
    const preview = options.preview?.() ?? {}
    const themes = [...PRESET_THEMES, ...(options.customThemes?.() ?? [])]
    const theme =
      preview.theme ??
      resolveTheme(
        preview.scheme ? { ...appearance, colorScheme: preview.scheme } : appearance,
        prefersDark(),
        themes,
      )
    applyTheme(root, theme)
    applyTypography(root, appearance, options.density ?? false)
  })
}
