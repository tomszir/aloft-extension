import { storage } from '#imports'
import {
  EMPTY_LEARNED,
  forgetPage,
  type LearnedPicks,
  normalizeLearned,
  recordPick,
} from '../core/learned'

// Local, never synced: what was typed and picked is browsing history, and
// belongs to this device only.
const learnedItem = storage.defineItem<unknown>('local:learned', { fallback: EMPTY_LEARNED })

export async function loadLearned(): Promise<LearnedPicks> {
  return normalizeLearned(await learnedItem.getValue())
}

export async function savePick(typed: string, page: { url: string; title: string }): Promise<void> {
  const learned = await loadLearned()
  await learnedItem.setValue(recordPick(learned, typed, page, Date.now()))
}

export async function forgetPicksOf(url: string): Promise<void> {
  const learned = await loadLearned()
  const kept = forgetPage(learned, url)
  if (kept !== learned) await learnedItem.setValue(kept)
}

export async function forgetLearned(): Promise<void> {
  await learnedItem.removeValue()
}
