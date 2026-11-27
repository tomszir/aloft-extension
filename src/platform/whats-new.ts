import { browser } from 'wxt/browser'
import { storage } from '#imports'
import { compareVersions, type Release, worthTelling } from '../core/changelog'

// How long an update counts as news on the settings page. The palette mentions
// it only once.
const NEWS_FOR_MS = 14 * 24 * 60 * 60 * 1000

/** An update not yet looked at: the version it came from, and until when it's news. */
export interface WhatsNew {
  from: string
  until: number
  /** Set once the palette has mentioned it. */
  offered: boolean
}

const whatsNewItem = storage.defineItem<unknown>('local:whatsNew', { fallback: null })

function normalize(raw: unknown): WhatsNew | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const from: unknown = Reflect.get(raw, 'from')
  const until: unknown = Reflect.get(raw, 'until')
  const offered = Reflect.get(raw, 'offered') === true
  return typeof from === 'string' && typeof until === 'number'
    ? { from, until, offered }
    : undefined
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
  await whatsNewItem.setValue({ from, until: now + NEWS_FOR_MS, offered: false })
}

/** The update to mention, if there is one still worth mentioning. */
export async function loadWhatsNew(now: number): Promise<WhatsNew | undefined> {
  const whatsNew = normalize(await whatsNewItem.getValue())
  return whatsNew && whatsNew.until > now ? whatsNew : undefined
}

/**
 * True the first time the palette asks after an update worth mentioning, and
 * never again for that update: it's mentioned once, then left to the settings
 * page.
 */
export async function takeWhatsNewOffer(now: number): Promise<boolean> {
  const whatsNew = await loadWhatsNew(now)
  if (!whatsNew || whatsNew.offered) return false
  await whatsNewItem.setValue({ ...whatsNew, offered: true })
  return true
}

export async function dismissWhatsNew(): Promise<void> {
  await whatsNewItem.removeValue()
}

export const currentVersion = (): string => browser.runtime.getManifest().version
