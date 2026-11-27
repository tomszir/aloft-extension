// Stands in for src/app/use-zoom-correction.ts in the demo build: the demo
// shares the page's zoom, and must never set a style on the page's root.
export function useZoomCorrection(_tabId: Promise<number | undefined>, _root?: HTMLElement): void {}
