import { onCleanup } from 'solid-js'
import { watchZoom, zoomCorrection } from '../platform/zoom'

// Only for the overlay: a palette in its own tab was zoomed by the user on
// purpose, and undoing that would fight them.
export function useZoomCorrection(
  tabId: Promise<number | undefined>,
  root = document.documentElement,
) {
  let stop: (() => void) | undefined
  const apply = async (id: number) => {
    root.style.zoom = String(await zoomCorrection(id))
  }
  void tabId.then((id) => {
    if (id === undefined) return
    void apply(id)
    stop = watchZoom(id, () => void apply(id))
  })
  onCleanup(() => stop?.())
}
