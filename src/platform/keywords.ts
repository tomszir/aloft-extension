import { storage } from '#imports'
import { EMPTY_STORED_KEYWORDS, type StoredKeywords } from '../core/keywords'

// Its own item, apart from the settings: sync storage allows 8 KB per item,
// and the user's own keywords would otherwise eat into the settings' share.
// Stored as `unknown` and always resolved on the way out, like the settings.
const keywordsItem = storage.defineItem<unknown>('sync:keywords', {
  fallback: EMPTY_STORED_KEYWORDS,
})

export async function loadKeywords(): Promise<unknown> {
  return keywordsItem.getValue()
}

export async function saveKeywords(keywords: StoredKeywords): Promise<void> {
  await keywordsItem.setValue(keywords)
}

export function watchKeywords(onChange: (keywords: unknown) => void): () => void {
  return keywordsItem.watch(onChange)
}
