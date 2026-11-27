import { type Accessor, createEffect, createSignal, onCleanup } from 'solid-js'
import type { Settings } from '../core/settings'
import { resolveTheme } from '../core/theme'
import { applyTheme } from '../ui/theme/apply-theme'

/** `scheme`, when it gives one, wins over the setting and the system: the settings preview. */
export function useTheme(
  settings: Accessor<Settings>,
  root = document.documentElement,
  scheme: Accessor<'light' | 'dark' | undefined> = () => undefined,
): void {
  const query = matchMedia('(prefers-color-scheme: dark)')
  const [prefersDark, setPrefersDark] = createSignal(query.matches)
  const onChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches)
  query.addEventListener('change', onChange)
  onCleanup(() => query.removeEventListener('change', onChange))
  createEffect(() => {
    const { appearance } = settings()
    const forced = scheme()
    applyTheme(
      root,
      resolveTheme(forced ? { ...appearance, colorScheme: forced } : appearance, prefersDark()),
    )
  })
}
