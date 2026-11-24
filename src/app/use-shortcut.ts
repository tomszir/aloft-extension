import { type Accessor, createSignal, onCleanup } from 'solid-js'
import { openShortcut } from '../platform/commands'

export function useShortcut(): Accessor<string> {
  const [shortcut, setShortcut] = createSignal('')
  // Re-read when the tab regains focus: the user may have just changed the
  // shortcut on the browser's shortcuts page.
  const read = () => void openShortcut().then(setShortcut)
  read()
  window.addEventListener('focus', read)
  onCleanup(() => window.removeEventListener('focus', read))
  return shortcut
}
