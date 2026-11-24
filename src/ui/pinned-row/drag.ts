import { batch, createSignal, onCleanup } from 'solid-js'
import { type Cell, nearestCell, reorder } from '../../core/pinned'

/** Movement before a press becomes a drag, so a click still opens the pin. */
const DRAG_THRESHOLD = 4
/** How far past the row the pointer can go before the drop is called off. */
const ROW_MARGIN = 24
/** A one-row grid keeps the tile on its rail, with only this much give. */
const RAIL_GIVE = 10
const RAIL_DAMPING = 0.35
/** Fallback for when no transitionend arrives, as with reduced motion. */
const SETTLE_TIMEOUT = 400

interface Press {
  tabId: number
  from: number
  pointerId: number
  clientX: number
  clientY: number
}

interface Drag {
  tabId: number
  from: number
  to: number
  ids: readonly number[]
  /** Tile rectangles relative to the grid, by position in the row. */
  cells: readonly Cell[]
  grid: DOMRect
  grabX: number
  grabY: number
  startY: number
  x: number
  y: number
  settling: boolean
  /** Transitions are off, and the next frame swaps transforms for DOM order. */
  committing: boolean
}

export interface PinDragOptions {
  grid: () => HTMLElement | undefined
  ids: () => readonly number[]
  onDrop: (tabId: number, from: number, to: number) => void
}

/**
 * Pointer-driven reordering for the pinned row. The DOM order stays put while
 * dragging, and every tile is moved with a transform: moving a node in the DOM
 * would release its pointer capture mid-drag. The order is committed in one go
 * once the dropped tile has settled.
 */
export function createPinDrag(options: PinDragOptions) {
  const [drag, setDrag] = createSignal<Drag>()
  let press: Press | undefined
  let suppressClick = false
  let settleTimer: ReturnType<typeof setTimeout> | undefined
  let commitFrame: number | undefined

  const measure = (grid: HTMLElement): readonly Cell[] => {
    const origin = grid.getBoundingClientRect()
    return Array.from(grid.querySelectorAll('[data-pin-tile]'), (tile) => {
      const rect = tile.getBoundingClientRect()
      return {
        x: rect.left - origin.left,
        y: rect.top - origin.top,
        width: rect.width,
        height: rect.height,
      }
    })
  }

  const target = (d: Drag, clientX: number, clientY: number) => {
    const { grid } = d
    const outside =
      clientX < grid.left - ROW_MARGIN ||
      clientX > grid.right + ROW_MARGIN ||
      clientY < grid.top - ROW_MARGIN ||
      clientY > grid.bottom + ROW_MARGIN
    const home = d.cells[d.from]
    if (outside || !home) return d.from
    return nearestCell(d.cells, d.x + home.width / 2, d.y + home.height / 2)
  }

  const position = (d: Drag, clientX: number, clientY: number) => {
    const home = d.cells[d.from]
    const x = clientX - d.grid.left - d.grabX
    const oneRow = d.cells.every((cell) => cell.y === home?.y)
    if (oneRow && home) {
      const give = (clientY - d.startY) * RAIL_DAMPING
      return { x, y: home.y + Math.max(-RAIL_GIVE, Math.min(RAIL_GIVE, give)) }
    }
    return { x, y: clientY - d.grid.top - d.grabY }
  }

  // Two frames: transitions go off first, so nothing that reads layout in
  // between can turn the swap of transforms for DOM order into an animation.
  const finish = () => {
    clearTimeout(settleTimer)
    settleTimer = undefined
    const d = drag()
    if (!d || d.committing) return
    setDrag({ ...d, committing: true })
    commitFrame = requestAnimationFrame(() => {
      commitFrame = undefined
      batch(() => {
        if (d.to !== d.from) options.onDrop(d.tabId, d.from, d.to)
        setDrag(undefined)
      })
    })
  }

  const settle = (cancel: boolean) => {
    const d = drag()
    if (!d || d.settling) return
    window.removeEventListener('keydown', onEscape, true)
    setDrag({ ...d, to: cancel ? d.from : d.to, settling: true })
    settleTimer = setTimeout(finish, SETTLE_TIMEOUT)
  }

  // Captured on window, so Esc puts the tile back instead of closing Aloft.
  const onEscape = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopImmediatePropagation()
    settle(true)
  }

  onCleanup(() => {
    clearTimeout(settleTimer)
    if (commitFrame !== undefined) cancelAnimationFrame(commitFrame)
    window.removeEventListener('keydown', onEscape, true)
  })

  const lift = (p: Press, clientX: number, clientY: number) => {
    const grid = options.grid()
    if (!grid) return
    const cells = measure(grid)
    const home = cells[p.from]
    if (!home) return
    const origin = grid.getBoundingClientRect()
    suppressClick = true
    const d: Drag = {
      tabId: p.tabId,
      from: p.from,
      to: p.from,
      ids: options.ids(),
      cells,
      grid: origin,
      grabX: p.clientX - origin.left - home.x,
      grabY: p.clientY - origin.top - home.y,
      startY: p.clientY,
      x: home.x,
      y: home.y,
      settling: false,
      committing: false,
    }
    window.addEventListener('keydown', onEscape, true)
    setDrag(move(d, clientX, clientY))
  }

  const move = (d: Drag, clientX: number, clientY: number): Drag => {
    const next = { ...d, ...position(d, clientX, clientY) }
    return { ...next, to: target(next, clientX, clientY) }
  }

  return {
    /** Tiles animate between places only while this is true. */
    dragging: () => drag() !== undefined && !drag()?.committing,
    lifted: (tabId: number) => drag()?.tabId === tabId && !drag()?.settling,
    settling: (tabId: number) =>
      drag()?.tabId === tabId && drag()?.settling === true && !drag()?.committing,

    /** Where a tile is drawn, as an offset from its place in the DOM order. */
    offset(tabId: number, index: number): string | undefined {
      const d = drag()
      const home = d?.cells[index]
      if (!d || !home) return undefined
      if (tabId === d.tabId && !d.settling) return `translate(${d.x - home.x}px, ${d.y - home.y}px)`
      const shown = reorder(d.ids, d.from, d.to).indexOf(tabId)
      const cell = d.cells[shown]
      return cell ? `translate(${cell.x - home.x}px, ${cell.y - home.y}px)` : undefined
    },

    /** The cell the dragged tile will land in. */
    slot: (): Cell | undefined => {
      const d = drag()
      return d && !d.settling ? d.cells[d.to] : undefined
    },

    /** True once for the click that ends a drag, which shouldn't open the pin. */
    consumeClick(): boolean {
      const consumed = suppressClick
      suppressClick = false
      return consumed
    },

    onPointerDown(event: PointerEvent, tabId: number, from: number) {
      suppressClick = false
      if (event.button !== 0 || drag()) return
      press = {
        tabId,
        from,
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
      }
      ;(event.currentTarget as Element).setPointerCapture?.(event.pointerId)
    },

    onPointerMove(event: PointerEvent) {
      if (event.pointerId !== press?.pointerId) return
      const d = drag()
      if (d) {
        if (!d.settling) setDrag(move(d, event.clientX, event.clientY))
        return
      }
      const moved = Math.hypot(event.clientX - press.clientX, event.clientY - press.clientY)
      if (moved >= DRAG_THRESHOLD) lift(press, event.clientX, event.clientY)
    },

    onPointerUp(event: PointerEvent) {
      if (event.pointerId !== press?.pointerId) return
      press = undefined
      settle(false)
    },

    onPointerCancel(event: PointerEvent) {
      if (event.pointerId !== press?.pointerId) return
      press = undefined
      settle(true)
    },

    onSettled(event: TransitionEvent) {
      if (event.target !== event.currentTarget || event.propertyName !== 'transform') return
      if (drag()?.settling) finish()
    },
  }
}
