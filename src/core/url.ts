/** The page a URL points at, ignoring fragments and trailing slashes. */
export function pageKey(url: string): string {
  return url.replace(/#.*$/, '').replace(/\/$/, '')
}

/** The address without scheme or www. */
export const bareUrl = (url: string) => url.replace(/^[a-z]+:\/\//i, '').replace(/^www\./i, '')

/**
 * The address to navigate to. Helium shows its own pages as helium://, but
 * only opens that scheme in a new tab: sending an existing tab there asks for
 * an outside app instead. The same pages open either way as chrome://.
 */
export const navigableUrl = (url: string) => url.replace(/^helium:/i, 'chrome:')
