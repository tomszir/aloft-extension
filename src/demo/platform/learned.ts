import { type LearnedPicks, recordPick } from '../../core/learned'
import { session } from '../session'

// In memory for the demo build, and gone when the demo is.
export const loadLearned = async (): Promise<LearnedPicks> => session().learned

export async function savePick(typed: string, page: { url: string; title: string }): Promise<void> {
  const s = session()
  s.learned = recordPick(s.learned, typed, page, Date.now())
}

export async function forgetLearned(): Promise<void> {
  session().learned = { picks: [] }
}
