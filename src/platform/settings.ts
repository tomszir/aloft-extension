import { storage } from '#imports'
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  SETTINGS_VERSION,
  type Settings,
} from '../core/settings'

// Stored as `unknown`: whatever is in sync storage may come from an older
// version or another device, so it is always normalized on the way out.
const settingsItem = storage.defineItem<unknown>('sync:settings', {
  fallback: DEFAULT_SETTINGS,
  version: SETTINGS_VERSION,
})

export async function loadSettings(): Promise<Settings> {
  return normalizeSettings(await settingsItem.getValue())
}

export async function saveSettings(settings: Settings): Promise<void> {
  await settingsItem.setValue(normalizeSettings(settings))
}

export function watchSettings(onChange: (settings: Settings) => void): () => void {
  return settingsItem.watch((value) => onChange(normalizeSettings(value)))
}
