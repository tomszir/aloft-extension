// No icons in the demo build: fetching one would be a network request, and the
// invented sites have none. Every page gets its letter tile.
export const pageFavicon = (_pageUrl: string): null => null
