import { type Accessor, createSignal, onCleanup } from 'solid-js'
import { DEFAULT_SETTINGS, type Settings } from '../core/settings'
import { loadSettings, saveSettings, watchSettings } from '../platform/settings'

export interface SettingsHandle {
  settings: Accessor<Settings>
  update: (change: (current: Settings) => Settings) => Promise<void>
}

// Renders with `initial` first, the defaults unless the page already read
// them, so a page never waits on storage to appear.
export function useSettings(initial?: Settings): SettingsHandle {
  const [settings, setSettings] = createSignal<Settings>(initial ?? DEFAULT_SETTINGS)
  if (!initial) void loadSettings().then(setSettings)
  onCleanup(watchSettings(setSettings))
  return {
    settings,
    update: async (change) => {
      const next = change(await loadSettings())
      setSettings(next)
      await saveSettings(next)
    },
  }
}
