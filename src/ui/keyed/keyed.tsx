import { type Accessor, createMemo, For, type JSX } from 'solid-js'

export interface KeyedProps<T, K> {
  each: readonly T[]
  by: (item: T) => K
  children: (item: Accessor<T>, index: Accessor<number>) => JSX.Element
}

/**
 * A <For> that keeps each element for as long as its key stays in the list.
 * <For> matches items by reference, and the palette rebuilds its items on
 * every tab event, so rows would be replaced under the cursor: a press that
 * started on the old row then never becomes a click on any row.
 */
export function Keyed<T, K>(props: KeyedProps<T, K>): JSX.Element {
  const byKey = createMemo(() => new Map(props.each.map((item) => [props.by(item), item])))
  const keys = createMemo(() => props.each.map((item) => props.by(item)))
  return (
    <For each={keys()}>
      {(key, index) => {
        const first = byKey().get(key)
        if (first === undefined) return null
        // Keeps the last item while a removed key's row is being disposed.
        const item = createMemo((last: T) => byKey().get(key) ?? last, first)
        return props.children(item, index)
      }}
    </For>
  )
}
