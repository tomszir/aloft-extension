// The invented browser behind the web demo, the store screenshots and the
// marquee tile: made-up sites on a reserved domain, so there are no real brands
// and nothing points anywhere. Plain data, so `scripts/demo.ts` can import it
// under Node as well as the demo bundle.

export interface Site {
  host: string
  title: string
  color: string
  letter: string
}

export const SITE = (host: string, title: string, color: string): Site => ({
  host,
  title,
  color,
  letter: title.charAt(0),
})

export const PINS: readonly Site[] = [
  SITE('mail', 'Inbox — Postbox', '#3B82F6'),
  SITE('calendar', 'Week 48 — Daybook', '#10B981'),
  SITE('chat', 'Team chat — Murmur', '#8B5CF6'),
  SITE('music', 'Focus mix — Tones', '#F59E0B'),
]

export const TABS: readonly Site[] = [
  // The page behind the palette; its accent shows around every screenshot
  // crop, so it stays in the brand's blues instead of clashing with them.
  SITE('notes', 'Keyboard-first browsing — Field Notes', '#6366F1'),
  SITE('docs', 'Release checklist — Handbook', '#0EA5E9'),
  SITE('maps', 'Weekend trip — Waypoint', '#22C55E'),
]

export const CLOSED: Site = SITE('recipes', 'Sourdough, step by step — Crumb', '#D97706')
export const BOOKMARK: Site = SITE('keys', 'Keyboard shortcuts reference — Handbook', '#0EA5E9')

export const siteUrl = (site: Site, path = ''): string => `https://${site.host}.aloft.test/${path}`

export interface DemoPage {
  title: string
  url: string
}

const page = (host: string, path: string, title: string): DemoPage => ({
  title,
  url: `https://${host}.aloft.test/${path}`,
})

/** Pages visited before, newest first; the web demo also lists the sites above. */
export const HISTORY: readonly DemoPage[] = [
  page('docs', 'onboarding', 'Onboarding guide — Handbook'),
  page('maps', 'coffee', 'Coffee near the station — Waypoint'),
  page('notes', 'fewer-tabs', 'Fewer tabs, more focus — Field Notes'),
  page('recipes', 'dal', 'Weeknight dal — Crumb'),
  page('docs', 'style', 'Writing style guide — Handbook'),
  page('music', 'rain', 'Rainy day jazz — Tones'),
  page('maps', 'trails', 'Hiking trails nearby — Waypoint'),
  page('notes', 'shortcuts', 'Shortcuts worth learning — Field Notes'),
  page('calendar', 'week-47', 'Week 47 — Daybook'),
  page('recipes', 'focaccia', 'Focaccia for beginners — Crumb'),
]

/** The web demo's bookmarks, besides {@link BOOKMARK}. */
export const BOOKMARKS: readonly DemoPage[] = [
  page('docs', 'handbook', 'Team handbook — Handbook'),
  page('maps', 'packing', 'Packing list — Waypoint'),
  page('recipes', 'starter', 'Feeding a starter — Crumb'),
  page('notes', 'reading', 'Reading list — Field Notes'),
]
