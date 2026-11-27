import type { ActionId } from '../core/actions'
import { EMPTY_STORED_KEYWORDS } from '../core/keywords'
import { EMPTY_LEARNED, type LearnedPicks } from '../core/learned'
import type { Settings } from '../core/settings'
import type { Theme } from '../core/theme'
import { DemoBrowser } from './browser-state'

/** A value held in memory, with listeners: the demo's stand-in for extension storage. */
export class Store<T> {
  private readonly listeners = new Set<(value: T) => void>()
  constructor(private value: T) {}
  get(): T {
    return this.value
  }
  set(value: T): void {
    this.value = value
    for (const listener of [...this.listeners]) listener(value)
  }
  watch(listener: (value: T) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}

/** What the visitor did, for the tour to notice. */
export type DemoSignal =
  | { kind: 'search'; text: string }
  | { kind: 'open-pin' }
  | { kind: 'action'; action: ActionId }
  /** A keyword's chip appeared in the search box. */
  | { kind: 'keyword' }
  | { kind: 'theme' }

export interface SessionHooks {
  /** Something that would leave the page, described for the host page. */
  would: (what: string) => void
  /** Esc or a click outside: the bar closes. */
  dismiss: () => void
  /** The bar closed after acting; it opens again on the changed state. */
  reopen: () => void
  signal: (signal: DemoSignal) => void
}

/**
 * Everything the fake platform modules read and change, for one mounted demo:
 * the invented browser, and settings, themes, keywords and learned picks in
 * memory, never in extension storage.
 */
export class DemoSession {
  browser = new DemoBrowser()
  readonly settings: Store<Settings>
  readonly themes: Store<readonly Theme[]>
  readonly keywords = new Store<unknown>(EMPTY_STORED_KEYWORDS)
  learned: LearnedPicks = EMPTY_LEARNED
  /** Where the theme's variables go: the demo's own element, never the page's root. */
  root: HTMLElement | undefined
  /** Set when the palette acted, so the close that follows reopens it instead. */
  acted = false

  constructor(
    settings: Settings,
    themes: readonly Theme[],
    readonly hooks: SessionHooks,
  ) {
    this.settings = new Store(settings)
    this.themes = new Store(themes)
  }

  /** A fresh browser, as the tour starts from. */
  reset(): void {
    this.browser = new DemoBrowser()
    this.learned = EMPTY_LEARNED
  }
}

let current: DemoSession | undefined

export function setSession(session: DemoSession | undefined): void {
  current = session
}

export function session(): DemoSession {
  if (!current) throw new Error('Aloft demo: nothing is mounted')
  return current
}
