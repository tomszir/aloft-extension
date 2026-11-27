import { type Accessor, createSignal, onCleanup } from 'solid-js'
import type { Theme } from '../core/theme'
import { loadCustomThemes, saveCustomThemes, watchCustomThemes } from '../platform/themes'

export interface CustomThemesHandle {
  themes: Accessor<readonly Theme[]>
  /** False, saving nothing, when they wouldn't fit in sync storage. */
  save: (themes: readonly Theme[]) => Promise<boolean>
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
      if (saved) setThemes(next)
      return saved
    },
  }
}
