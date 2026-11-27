import { i18n } from '#i18n'
import type { Shortcuts } from '../../core/shortcut'
import { Button } from '../button/button'
import { CtrlTSetup } from '../ctrl-t-setup/ctrl-t-setup'
import { Logo } from '../logo/logo'
import { ShortcutSentence } from '../shortcut-sentence/shortcut-sentence'
import styles from './onboarding.module.css'

export interface OnboardingProps {
  shortcuts: Shortcuts
  onChangeShortcut: () => void
}

export function Onboarding(props: OnboardingProps) {
  return (
    <main class={styles.page}>
      <header class={styles.header}>
        <Logo />
        <h1 class={styles.title}>{i18n.t('onboardingTitle')}</h1>
      </header>

      <section class={`${styles.card} ${styles.shortcut}`}>
        <ShortcutSentence shortcut={props.shortcuts.main} class={styles.text} />
        <Button onClick={() => props.onChangeShortcut()}>
          {i18n.t('onboardingChangeShortcut')}
        </Button>
      </section>

      <section class={styles.card} aria-labelledby="ctrl-t-title">
        <h2 id="ctrl-t-title" class={styles.heading}>
          {i18n.t('onboardingCtrlTTitle')}
        </h2>
        <CtrlTSetup shortcuts={props.shortcuts} onSetUp={props.onChangeShortcut} />
      </section>
    </main>
  )
}
