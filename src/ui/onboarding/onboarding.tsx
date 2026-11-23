import { Match, Show, Switch } from 'solid-js'
import { i18n } from '#i18n'
import { Button } from '../button/button'
import { Kbd } from '../kbd/kbd'
import styles from './onboarding.module.css'

export type AccessState = 'unknown' | 'granted' | 'denied' | 'not-asked'

export interface OnboardingProps {
  /** Empty when the user cleared the shortcut or another extension took it. */
  shortcut: string
  access: AccessState
  onAllow: () => void
  onChangeShortcut: () => void
}

export function Onboarding(props: OnboardingProps) {
  return (
    <main class={styles.page}>
      <h1 class={styles.title}>{i18n.t('onboardingTitle')}</h1>

      <section class={styles.card}>
        <Show
          when={props.shortcut}
          fallback={<p class={styles.text}>{i18n.t('onboardingNoShortcut')}</p>}
        >
          {(shortcut) => {
            // Split around a placeholder so the shortcut renders as a key cap
            // while translators still control the sentence's word order.
            const [before, after] = i18n.t('onboardingShortcut', ['\u0000']).split('\u0000')
            return (
              <p class={styles.text}>
                {before}
                <Kbd>{shortcut()}</Kbd>
                {after}
              </p>
            )
          }}
        </Show>
        <div>
          <Button onClick={() => props.onChangeShortcut()}>
            {i18n.t('onboardingChangeShortcut')}
          </Button>
        </div>
      </section>

      <section class={styles.card} aria-labelledby="ctrl-t-title">
        <h2 id="ctrl-t-title" class={styles.heading}>
          {i18n.t('onboardingCtrlTTitle')}
        </h2>
        <p class={styles.text}>{i18n.t('onboardingCtrlTBody')}</p>
        <p class={styles.note}>{i18n.t('onboardingPrivacy')}</p>
        <div aria-live="polite">
          <Switch>
            <Match when={props.access === 'granted'}>
              <p class={styles.success}>{i18n.t('onboardingAllowed')}</p>
            </Match>
            <Match when={props.access === 'not-asked' || props.access === 'denied'}>
              <div class={styles.actions}>
                <Button variant="primary" onClick={() => props.onAllow()}>
                  {i18n.t('onboardingAllow')}
                </Button>
                <span class={styles.note}>
                  {props.access === 'denied'
                    ? i18n.t('onboardingDenied')
                    : i18n.t('onboardingWithout')}
                </span>
              </div>
            </Match>
          </Switch>
        </div>
      </section>
    </main>
  )
}
