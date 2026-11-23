import { type Accessor, createEffect, createSignal, onCleanup } from 'solid-js'
import type { Settings } from '../core/settings'
import { resolveTheme } from '../core/theme'
import { applyTheme } from '../ui/theme/apply-theme'

export function useTheme(settings: Accessor<Settings>, root = document.documentElement): void {
  const query = matchMedia('(prefers-color-scheme: dark)')
  const [prefersDark, setPrefersDark] = createSignal(query.matches)
  const onChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches)
  query.addEventListener('change', onChange)
  onCleanup(() => query.removeEventListener('change', onChange))
  createEffect(() => applyTheme(root, resolveTheme(settings().appearance, prefersDark())))
}
