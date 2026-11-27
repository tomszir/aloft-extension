import type { Theme, ThemesSaved } from '../../core/theme'
import { session } from '../session'

// In memory for the demo build, never chrome.storage.
export const loadCustomThemes = async (): Promise<Theme[]> => [...session().themes.get()]

export async function saveCustomThemes(themes: readonly Theme[]): Promise<ThemesSaved> {
  session().themes.set(themes)
  return 'saved'
}

export const watchCustomThemes = (onChange: (themes: Theme[]) => void): (() => void) =>
  session().themes.watch((themes) => onChange([...themes]))
