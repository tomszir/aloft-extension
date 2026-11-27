import { createMemo, createSignal, For, onCleanup, Show } from 'solid-js'
import type { Theme } from '../../core/theme'
import { Button } from '../../ui/button/button'
import { Kbd } from '../../ui/kbd/kbd'
import { ThemePicker } from '../../ui/theme-picker/theme-picker'
import { t } from '../i18n'
import type { DemoSignal } from '../session'
import { advanceAfter, completes, STEPS, withKeys } from './steps'
import styles from './tour.module.css'

export interface TourProps {
  /** Calls back with everything the visitor does in the demo. */
  subscribe: (listener: (signal: DemoSignal) => void) => () => void
  /** Touch screens have no Alt key, so the pin step asks for a tap. */
  touch: boolean
  themes: readonly Theme[]
  themeId: string
  onTheme: (themeId: string) => void
  /** Puts focus back in the bar's search box. */
  onRefocus: () => void
  onSkip: () => void
  onFinish: () => void
  /** Esc on the tour's own controls; in the search box, the bar has it. */
  onEscape: () => void
}

/**
 * A short tour on top of the live demo: each step asks for one thing, notices
 * when it's done and moves on. The controls are ordinary buttons, reached by
 * Shift+Tab from the search box; the steps themselves are all done in the bar.
 */
let nextId = 0

export function Tour(props: TourProps) {
  const titleId = `al-tour-title-${nextId++}`
  const [index, setIndex] = createSignal(0)
  const [done, setDone] = createSignal(false)
  const step = createMemo(() => STEPS[index()] ?? STEPS[0])
  const last = () => index() === STEPS.length - 1

  let timer: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => clearTimeout(timer))

  const goTo = (next: number) => {
    clearTimeout(timer)
    setDone(false)
    setIndex(next)
  }
  const next = () => {
    if (last()) props.onFinish()
    else goTo(index() + 1)
  }

  onCleanup(
    props.subscribe((signal) => {
      const current = step()
      if (!current || !completes(current.id, signal)) return
      setDone(true)
      const wait = advanceAfter(current.id)
      if (wait === undefined) return
      // Each matching signal starts the wait over: typing on isn't a pause.
      clearTimeout(timer)
      const at = index()
      timer = setTimeout(() => {
        if (index() === at) goTo(at + 1)
      }, wait)
    }),
  )

  // A click on a control would leave focus on it; the steps happen in the bar.
  let pointer = false
  const refocusAfterPointer = () => {
    if (pointer) props.onRefocus()
    pointer = false
  }

  const body = () => {
    const current = step()
    if (!current) return []
    const key = props.touch && current.touchBody ? current.touchBody : current.body
    return withKeys(t(key))
  }

  return (
    <section
      class={styles.card}
      aria-label={t('tourLabel')}
      onPointerDown={() => {
        pointer = true
      }}
      onKeyDown={(event) => {
        pointer = false
        if (event.key === 'Escape') {
          event.preventDefault()
          props.onEscape()
        }
      }}
    >
      <div class={styles.text} aria-live="polite" aria-atomic="true">
        <p class={styles.count}>
          {t('tourStepCount', [String(index() + 1), String(STEPS.length)])}
        </p>
        <h2 class={styles.title} id={titleId}>
          {t(step()?.title ?? 'tourSearchTitle')}
          <Show when={done()}>
            {' '}
            <span class={styles.done}>{t('tourStepDone')}</span>
          </Show>
        </h2>
        <p class={styles.body}>
          <For each={body()}>
            {(part) => (typeof part === 'number' ? <Kbd>{step()?.keys[part] ?? ''}</Kbd> : part)}
          </For>
        </p>
      </div>
      <Show when={step()?.id === 'theme'}>
        <ThemePicker
          label={t('tourThemePicker')}
          themes={props.themes}
          value={props.themeId}
          onChange={(id) => {
            props.onTheme(id)
            refocusAfterPointer()
          }}
        />
      </Show>
      <div class={styles.controls}>
        <Button
          variant="ghost"
          onClick={() => {
            props.onSkip()
            refocusAfterPointer()
          }}
        >
          {t('tourSkip')}
        </Button>
        <Button
          variant={done() || last() ? 'primary' : 'secondary'}
          onClick={() => {
            next()
            refocusAfterPointer()
          }}
        >
          {last() ? t('tourFinish') : t('tourNext')}
        </Button>
      </div>
    </section>
  )
}
