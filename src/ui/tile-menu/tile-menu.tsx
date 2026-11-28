import { onMount } from 'solid-js'
import { Keyed } from '../keyed/keyed'
import styles from './tile-menu.module.css'

export interface MenuItem {
  label: string
  disabled?: boolean
  danger?: boolean
  run: () => void
}

export interface TileMenuProps {
  label: string
  /** Viewport coordinates of the menu's top-left corner. */
  x: number
  y: number
  items: readonly MenuItem[]
  onClose: () => void
}

export function TileMenu(props: TileMenuProps) {
  let menu: HTMLDivElement | undefined
  const buttons = () =>
    [...(menu?.querySelectorAll<HTMLButtonElement>('button') ?? [])].filter((b) => !b.disabled)

  onMount(() => {
    // Kept on screen: a menu opened low down, or by a right click near the
    // edge, would otherwise run out of the frame.
    if (menu) {
      const { width, height } = menu.getBoundingClientRect()
      const gap = 4
      menu.style.left = `${Math.max(gap, Math.min(props.x, innerWidth - width - gap))}px`
      menu.style.top = `${Math.max(gap, Math.min(props.y, innerHeight - height - gap))}px`
    }
    buttons()[0]?.focus()
  })

  const onKeyDown = (event: KeyboardEvent) => {
    const list = buttons()
    const current = list.indexOf(document.activeElement as HTMLButtonElement)
    const focus = (index: number) => list[(index + list.length) % list.length]?.focus()
    if (event.key === 'ArrowDown') focus(current + 1)
    else if (event.key === 'ArrowUp') focus(current - 1)
    else if (event.key === 'Home') focus(0)
    else if (event.key === 'End') focus(list.length - 1)
    else if (event.key === 'Escape' || event.key === 'Tab') props.onClose()
    else return
    event.preventDefault()
    // The palette closes on Escape too; this one only closes the menu.
    event.stopPropagation()
  }

  return (
    <>
      <button
        type="button"
        class={styles.dismiss}
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => props.onClose()}
        onContextMenu={(event) => {
          event.preventDefault()
          props.onClose()
        }}
      />
      <div
        ref={menu}
        class={styles.menu}
        role="menu"
        aria-label={props.label}
        style={{ left: `${props.x}px`, top: `${props.y}px` }}
        onKeyDown={onKeyDown}
      >
        <Keyed each={props.items} by={(item) => item.label}>
          {(item) => (
            <button
              type="button"
              role="menuitem"
              class={styles.item}
              data-danger={item().danger || undefined}
              disabled={item().disabled}
              tabIndex={-1}
              onClick={() => {
                props.onClose()
                item().run()
              }}
            >
              {item().label}
            </button>
          )}
        </Keyed>
      </div>
    </>
  )
}
