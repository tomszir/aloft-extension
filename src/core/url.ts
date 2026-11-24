/** The page a URL points at, ignoring fragments and trailing slashes. */
export function pageKey(url: string): string {
  return url.replace(/#.*$/, '').replace(/\/$/, '')
}

/** The address without scheme or www. */
export const bareUrl = (url: string) => url.replace(/^[a-z]+:\/\//i, '').replace(/^www\./i, '')
