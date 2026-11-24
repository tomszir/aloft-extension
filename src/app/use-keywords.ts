import { type Accessor, createMemo, createSignal, onCleanup } from 'solid-js'
import { BUILT_IN_KEYWORDS, type Keyword, resolveKeywords } from '../core/keywords'
import { loadKeywords, watchKeywords } from '../platform/keywords'

// Renders with the built-ins first, so the palette never waits on storage.
export function useKeywords(): Accessor<readonly Keyword[]> {
  const [stored, setStored] = createSignal<unknown>()
  void loadKeywords().then(setStored)
  onCleanup(watchKeywords(setStored))
  return createMemo(() => (stored() === undefined ? BUILT_IN_KEYWORDS : resolveKeywords(stored())))
}
