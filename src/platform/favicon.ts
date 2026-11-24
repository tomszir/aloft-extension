import { browser } from 'wxt/browser'

// The browser's own favicon cache, so showing icons never fetches anything
// from the sites themselves.
function faviconUrl(pageUrl: string, size = 32): string {
  const url = new URL(`chrome-extension://${browser.runtime.id}/_favicon/`)
  url.searchParams.set('pageUrl', pageUrl)
  url.searchParams.set('size', String(size))
  return url.href
}

// The cache answers every page it has no icon for with the same generic globe,
// which differs between browsers and builds, so it can't be hardcoded. A
// .invalid host can never have been visited, so its answer is that globe.
const NO_ICON_PAGE = 'https://aloft.invalid/'

async function bytes(src: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(src)
    return response.ok ? new Uint8Array(await response.arrayBuffer()) : null
  } catch {
    return null
  }
}

const sameBytes = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((byte, i) => byte === b[i])

let genericIcon: Promise<Uint8Array | null> | undefined
const icons = new Map<string, Promise<string | null>>()
const known = new Map<string, string | null>()

/**
 * The page's icon, or null when the browser only has its generic one; as a
 * plain value once it's known, so rows don't wait a tick for it.
 */
export function pageFavicon(pageUrl: string): string | null | Promise<string | null> {
  // Firefox has no favicon cache an extension can read, and a tab's
  // favIconUrl is usually the site's own address, which loading would fetch.
  // So every page gets its letter tile, straight away.
  if (import.meta.env.FIREFOX) return null
  const answer = known.get(pageUrl)
  if (answer !== undefined) return answer
  let icon = icons.get(pageUrl)
  if (!icon) {
    const src = faviconUrl(pageUrl)
    genericIcon ??= bytes(faviconUrl(NO_ICON_PAGE))
    icon = Promise.all([bytes(src), genericIcon]).then(([own, generic]) => {
      if (own === null) return null
      return generic !== null && sameBytes(own, generic) ? null : src
    })
    void icon.then((answer) => known.set(pageUrl, answer))
    icons.set(pageUrl, icon)
  }
  return icon
}
