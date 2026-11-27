import { storage } from '#imports'
import { customThemesFitSync, normalizeCustomThemes, type Theme } from '../core/theme'

// Its own sync item, like the keywords, so themes don't eat into the
// settings' 8 KB. Always normalized on the way out.
const themesItem = storage.defineItem<unknown>('sync:themes', { fallback: [] })

export async function loadCustomThemes(): Promise<Theme[]> {
  return normalizeCustomThemes(await themesItem.getValue())
}

/** False, saving nothing, when the themes don't fit in one sync item. */
export async function saveCustomThemes(themes: readonly Theme[]): Promise<boolean> {
  if (!customThemesFitSync(themes)) return false
  await themesItem.setValue(themes)
  return true
}

export function watchCustomThemes(onChange: (themes: Theme[]) => void): () => void {
  return themesItem.watch((raw) => onChange(normalizeCustomThemes(raw)))
}
