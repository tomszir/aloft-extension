import { render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { describe, expect, it } from 'vitest'
import { Keyed } from './keyed'

interface Item {
  id: string
  label: string
}

function setup(initial: Item[]) {
  const [items, setItems] = createSignal(initial)
  render(() => (
    <ul>
      <Keyed each={items()} by={(item) => item.id}>
        {(item, index) => (
          <li data-id={item().id}>
            {index()}:{item().label}
          </li>
        )}
      </Keyed>
    </ul>
  ))
  return setItems
}

const node = (id: string) => document.querySelector(`[data-id="${id}"]`)

describe('Keyed', () => {
  it('keeps the element when its item is rebuilt with the same key', () => {
    const setItems = setup([{ id: 'a', label: 'Mail' }])
    const before = node('a')
    setItems([{ id: 'a', label: 'Mail' }])
    expect(node('a')).toBe(before)
  })

  it('updates a kept element in place when its item changes', () => {
    const setItems = setup([{ id: 'a', label: 'Mail' }])
    const before = node('a')
    setItems([{ id: 'a', label: 'Inbox' }])
    expect(node('a')).toBe(before)
    expect(screen.getByText('0:Inbox')).toBeTruthy()
  })

  it('adds, removes and reorders by key', () => {
    const setItems = setup([
      { id: 'a', label: 'Mail' },
      { id: 'b', label: 'Calendar' },
    ])
    const b = node('b')
    setItems([
      { id: 'b', label: 'Calendar' },
      { id: 'c', label: 'Music' },
    ])
    expect(node('a')).toBeNull()
    expect(node('b')).toBe(b)
    expect([...document.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      '0:Calendar',
      '1:Music',
    ])
  })
})
