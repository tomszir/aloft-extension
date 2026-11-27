import type { DemoKey } from '../i18n'
import type { DemoSignal } from '../session'

export type StepId = 'search' | 'pin' | 'actions' | 'site' | 'theme'

export interface Step {
  id: StepId
  title: DemoKey
  /** `$1`… in the text are drawn as these keys. */
  body: DemoKey
  keys: readonly string[]
  /** For touch screens, where there's no Alt key. */
  touchBody?: DemoKey
}

export const STEPS: readonly Step[] = [
  { id: 'search', title: 'tourSearchTitle', body: 'tourSearchBody', keys: [] },
  {
    id: 'pin',
    title: 'tourPinTitle',
    body: 'tourPinBody',
    keys: ['Alt+1'],
    touchBody: 'tourPinBodyTouch',
  },
  { id: 'actions', title: 'tourActionsTitle', body: 'tourActionsBody', keys: ['>'] },
  { id: 'site', title: 'tourSiteTitle', body: 'tourSiteBody', keys: ['yt', '@'] },
  { id: 'theme', title: 'tourThemeTitle', body: 'tourThemeBody', keys: [] },
]

/** Whether what the visitor just did is what `step` asks for. */
export function completes(step: StepId, signal: DemoSignal): boolean {
  switch (step) {
    case 'search':
      return signal.kind === 'search' && signal.text.trim().length >= 2
    case 'pin':
      return signal.kind === 'open-pin'
    case 'actions':
      return signal.kind === 'action'
    case 'site':
      return signal.kind === 'keyword'
    case 'theme':
      return signal.kind === 'theme'
  }
}

/**
 * How long a finished step stays before the next one: typing goes on after
 * the first matching letters, so the search step waits for a pause. The last
 * step waits for Finish, so a theme can be tried and changed again.
 */
export function advanceAfter(step: StepId): number | undefined {
  if (step === 'theme') return undefined
  return step === 'search' ? 1500 : 900
}

/** Splits a message on its `$1`… placeholders: text, then the key's index, alternately. */
export function withKeys(text: string): (string | number)[] {
  return text.split(/\$(\d)/).map((part, i) => (i % 2 === 1 ? Number(part) - 1 : part))
}
