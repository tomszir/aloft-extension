import { browser } from 'wxt/browser'
import { storage } from '#imports'
import { compareVersions, type Release, worthTelling } from '../core/changelog'

// How long the palette offers what's new after an update. It's a quiet line in
// the footer, but one that never went away would stop being news.
const OFFER_FOR_MS = 14 * 24 * 60 * 60 * 1000

/** An update not yet looked at: the version it came from, and until when to mention it. */
export interface WhatsNew {
  from: string
  until: number
}

const whatsNewItem = storage.defineItem<unknown>('local:whatsNew', { fallback: null })

function normalize(raw: unknown): WhatsNew | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const from: unknown = Reflect.get(raw, 'from')
  const until: unknown = Reflect.get(raw, 'until')
  return typeof from === 'string' && typeof until === 'number' ? { from, until } : undefined
}

/**
 * Remembers an update from `previous` to `current` when its notes say more
 * than small fixes. Updates that come before the last one was looked at add
 * up, so nothing in between is skipped.
 */
export async function noteUpdate(
  previous: string,
  current: string,
  releases: readonly Release[],
  now: number,
): Promise<void> {
  const pending = normalize(await whatsNewItem.getValue())
  const from =
    pending && pending.until > now && compareVersions(pending.from, previous) < 0
      ? pending.from
      : previous
  if (worthTelling(releases, from, current).length === 0) return
  await whatsNewItem.setValue({ from, until: now + OFFER_FOR_MS })
}

/** The update to mention, if there is one still worth mentioning. */
export async function loadWhatsNew(now: number): Promise<WhatsNew | undefined> {
  const whatsNew = normalize(await whatsNewItem.getValue())
  return whatsNew && whatsNew.until > now ? whatsNew : undefined
}

export async function dismissWhatsNew(): Promise<void> {
  await whatsNewItem.removeValue()
}

export const currentVersion = (): string => browser.runtime.getManifest().version
