import type { Settings } from '../../core/settings'
import { session } from '../session'

// In memory for the demo build, never chrome.storage.
export const loadSettings = async (): Promise<Settings> => session().settings.get()

export async function saveSettings(settings: Settings): Promise<void> {
  const s = session()
  const before = s.settings.get().appearance
  s.settings.set(settings)
  const after = settings.appearance
  if (
    before.colorScheme !== after.colorScheme ||
    before.lightTheme !== after.lightTheme ||
    before.darkTheme !== after.darkTheme
  )
    s.hooks.signal({ kind: 'theme' })
}

export const hadNewTabReplacement = async () => false

export const watchSettings = (onChange: (settings: Settings) => void): (() => void) =>
  session().settings.watch(onChange)
