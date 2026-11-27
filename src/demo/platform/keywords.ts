import type { StoredKeywords } from '../../core/keywords'
import { session } from '../session'

// In memory for the demo build: the built-in keywords, unless changed.
export const loadKeywords = async (): Promise<unknown> => session().keywords.get()

export async function saveKeywords(keywords: StoredKeywords): Promise<void> {
  session().keywords.set(keywords)
}

export const watchKeywords = (onChange: (keywords: unknown) => void): (() => void) =>
  session().keywords.watch(onChange)
