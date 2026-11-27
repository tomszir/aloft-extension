import { type Accessor, createSignal, onCleanup } from 'solid-js'
import type { Theme, ThemesSaved } from '../core/theme'
import { loadCustomThemes, saveCustomThemes, watchCustomThemes } from '../platform/themes'

export interface CustomThemesHandle {
  themes: Accessor<readonly Theme[]>
  save: (themes: readonly Theme[]) => Promise<ThemesSaved>
}

/** `initial`, when the page read them before drawing, so it starts in the right theme. */
export function useCustomThemes(initial?: readonly Theme[]): CustomThemesHandle {
  const [themes, setThemes] = createSignal<readonly Theme[]>(initial ?? [])
  if (!initial) void loadCustomThemes().then(setThemes)
  onCleanup(watchCustomThemes(setThemes))
  return {
    themes,
    save: async (next) => {
      const saved = await saveCustomThemes(next)
      if (saved === 'saved') setThemes(next)
      return saved
    },
  }
}
