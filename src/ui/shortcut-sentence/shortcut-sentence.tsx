import { Show } from 'solid-js'
import { i18n } from '#i18n'
import { Kbd } from '../kbd/kbd'

export interface ShortcutSentenceProps {
  /** Empty when the user cleared the shortcut or another extension took it. */
  shortcut: string
  class?: string
}

// The browser's getMessage drops a NUL substitution, so the marker is a
// private-use character that no translation will contain.
const MARKER = ''

export function ShortcutSentence(props: ShortcutSentenceProps) {
  return (
    <Show
      when={props.shortcut}
      fallback={<p class={props.class}>{i18n.t('onboardingNoShortcut')}</p>}
    >
      {(shortcut) => {
        // Split around the marker so the shortcut renders as a key cap while
        // translators still control the sentence's word order.
        const [before, after] = i18n.t('onboardingShortcut', [MARKER]).split(MARKER)
        return (
          <p class={props.class}>
            {before}
            <Kbd>{shortcut()}</Kbd>
            {after}
          </p>
        )
      }}
    </Show>
  )
}
