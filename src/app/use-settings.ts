import { type Accessor, createSignal, onCleanup } from 'solid-js'
import { DEFAULT_SETTINGS, type Settings } from '../core/settings'
import { loadSettings, saveSettings, watchSettings } from '../platform/settings'

export interface SettingsHandle {
  settings: Accessor<Settings>
  update: (change: (current: Settings) => Settings) => Promise<void>
}

// Renders with defaults first, so a page never waits on storage to appear.
export function useSettings(): SettingsHandle {
  const [settings, setSettings] = createSignal<Settings>(DEFAULT_SETTINGS)
  void loadSettings().then(setSettings)
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
