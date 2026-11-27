import { storage } from '#imports'
import {
  DEFAULT_SETTINGS,
  keepUnknown,
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
  const stored = await settingsItem.getValue()
  await settingsItem.setValue(keepUnknown(stored, normalizeSettings(settings)))
}

/**
 * Whether Ctrl+T replaced the new tab page before 1.0, which it did unless
 * switched off. Read from what's stored, since the setting is gone now.
 */
export async function hadNewTabReplacement(): Promise<boolean> {
  const stored: unknown = await settingsItem.getValue()
  return !(
    typeof stored === 'object' &&
    stored !== null &&
    Reflect.get(stored, 'replaceNewTab') === false
  )
}

export function watchSettings(onChange: (settings: Settings) => void): () => void {
  return settingsItem.watch((value) => onChange(normalizeSettings(value)))
}
