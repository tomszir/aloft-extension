import { storage } from '#imports'
import {
  customThemesFitSync,
  normalizeCustomThemes,
  type Theme,
  type ThemesSaved,
} from '../core/theme'

// Its own sync item, like the keywords, so themes don't eat into the
// settings' 8 KB. Always normalized on the way out.
const themesItem = storage.defineItem<unknown>('sync:themes', { fallback: [] })

export async function loadCustomThemes(): Promise<Theme[]> {
  return normalizeCustomThemes(await themesItem.getValue())
}

/**
 * Saves nothing when the themes don't fit in one sync item, or when sync
 * storage refuses the write (its total quota, or too many writes a minute).
 */
export async function saveCustomThemes(themes: readonly Theme[]): Promise<ThemesSaved> {
  if (!customThemesFitSync(themes)) return 'full'
  try {
    await themesItem.setValue(themes)
    return 'saved'
  } catch {
    return 'failed'
  }
}

export function watchCustomThemes(onChange: (themes: Theme[]) => void): () => void {
  return themesItem.watch((raw) => onChange(normalizeCustomThemes(raw)))
}
