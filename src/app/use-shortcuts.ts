import { type Accessor, createSignal, onCleanup } from 'solid-js'
import { NO_SHORTCUTS, type Shortcuts } from '../core/shortcut'
import { openShortcuts } from '../platform/commands'

export function useShortcuts(): Accessor<Shortcuts> {
  const [shortcuts, setShortcuts] = createSignal(NO_SHORTCUTS)
  // Re-read when the tab regains focus: the user may have just changed a
  // shortcut on the browser's shortcuts page.
  const read = () => void openShortcuts().then(setShortcuts)
  read()
  window.addEventListener('focus', read)
  onCleanup(() => window.removeEventListener('focus', read))
  return shortcuts
}
