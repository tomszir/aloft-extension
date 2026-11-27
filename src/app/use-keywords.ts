import { type Accessor, createMemo, createSignal, onCleanup } from 'solid-js'
import {
  BUILT_IN_KEYWORDS,
  fitsSync,
  type Keyword,
  resolveKeywords,
  toStored,
} from '../core/keywords'
import { loadKeywords, saveKeywords, watchKeywords } from '../platform/keywords'

export interface KeywordsHandle {
  keywords: Accessor<readonly Keyword[]>
  /** Settles once the stored keywords are in, for text that must be read with them. */
  ready: Promise<void>
  /** False, saving nothing, when the list is too big for one sync item. */
  save: (keywords: readonly Keyword[]) => Promise<boolean>
}

// Renders with the built-ins first, so the palette never waits on storage.
export function useKeywords(): KeywordsHandle {
  const [stored, setStored] = createSignal<unknown>()
  const ready = loadKeywords().then(
    (value) => {
      setStored(value)
    },
    () => undefined,
  )
  onCleanup(watchKeywords(setStored))
  const keywords = createMemo(() =>
    stored() === undefined ? BUILT_IN_KEYWORDS : resolveKeywords(stored()),
  )
  return {
    keywords,
    ready,
    save: async (next) => {
      const value = toStored(next)
      if (!fitsSync(value)) return false
      setStored(value)
      await saveKeywords(value)
      return true
    },
  }
}
