// The palette moves focus by finding document.activeElement among its
// controls. In the demo's shadow root, document.activeElement is the shadow
// host, so those moves would start from nowhere. This redoes them from the
// shadow root's own activeElement, before the palette sees the key.

export interface FocusParts {
  shadow: ShadowRoot
  /** The palette's dialog. */
  panel: () => Element | null
  /** The tour's card, when it's shown. */
  tour: () => Element | null
  input: () => HTMLInputElement | null
}

// The palette's own list of Tab stops (src/ui/palette/palette.tsx).
const PANEL_STOPS = 'input, button:not([tabindex="-1"])'

/** A radio group is one stop: its checked radio. */
function tourStops(card: Element | null): HTMLElement[] {
  if (!card) return []
  return [...card.querySelectorAll<HTMLElement>('button, input')].filter(
    (el) => !(el instanceof HTMLInputElement && el.type === 'radio' && !el.checked),
  )
}

const MENU_MOVES: Record<string, (current: number, count: number) => number> = {
  ArrowDown: (current) => current + 1,
  ArrowUp: (current) => current - 1,
  Home: () => 0,
  End: (_, count) => count - 1,
}

/** A capture-phase keydown listener for the shadow root. */
export function focusKeys(parts: FocusParts): (event: Event) => void {
  const { shadow } = parts
  const chipShown = () => shadow.querySelector('[data-mode="keyword"], [data-mode="actions"]')

  return (event) => {
    if (!(event instanceof KeyboardEvent) || event.isComposing) return
    if (event.altKey || event.ctrlKey || event.metaKey) return
    const active = shadow.activeElement
    const menu = active?.closest('[role="menu"]')
    if (menu) {
      const move = MENU_MOVES[event.key]
      if (!move) return
      const items = [...menu.querySelectorAll<HTMLButtonElement>('button')].filter(
        (b) => !b.disabled,
      )
      const at = items.findIndex((item) => item === active)
      const next = (move(at, items.length) + items.length) % items.length
      event.preventDefault()
      event.stopPropagation()
      items[next]?.focus()
      return
    }
    if (event.key !== 'Tab') return

    const stops = [
      ...(parts.panel()?.querySelectorAll<HTMLElement>(PANEL_STOPS) ?? []),
      ...tourStops(parts.tour()),
    ]
    const step = event.shiftKey ? -1 : 1
    const target = () => {
      const at = stops.findIndex((stop) => stop === active)
      if (at === -1) return event.shiftKey ? stops.at(-1) : stops[0]
      return stops[(at + step + stops.length) % stops.length]
    }
    const input = parts.input()
    if (active === input && input && !event.shiftKey) {
      // Tab in the search box may enter an offered keyword. The palette
      // decides; if it didn't take the key for that, the move happens here.
      const before = { text: input.value, chip: chipShown() }
      setTimeout(() => {
        if (shadow.activeElement !== input) return
        if (input.value !== before.text || chipShown() !== before.chip) return
        target()?.focus()
      })
      return
    }
    event.preventDefault()
    event.stopPropagation()
    target()?.focus()
  }
}
