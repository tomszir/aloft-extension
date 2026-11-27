import type { Accessor } from 'solid-js'
import { type ThemeOptions, useTheme as useThemeOn } from '../../app/use-theme'
import type { Settings } from '../../core/settings'
import { session } from '../session'

export type { PreviewOverride, ThemeOptions } from '../../app/use-theme'

// Stands in for src/app/use-theme.ts in the demo build, so the palette's theme
// goes on the demo's own element rather than the page's <html>.
export function useTheme(settings: Accessor<Settings>, options: ThemeOptions = {}): void {
  useThemeOn(settings, { ...options, root: options.root ?? session().root })
}
