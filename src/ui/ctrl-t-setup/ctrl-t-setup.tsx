import { Show } from 'solid-js'
import { i18n } from '#i18n'
import { opensWithNewTabKey, type Shortcuts } from '../../core/shortcut'
import { Button } from '../button/button'
import styles from './ctrl-t-setup.module.css'

export interface CtrlTSetupProps {
  shortcuts: Shortcuts
  /** Opens the browser's shortcuts page; Aloft can't assign the key itself. */
  onSetUp: () => void
}

/**
 * Optional: browsers won't let an extension suggest Ctrl+T, but a person can
 * give it to Aloft's second command, which keeps Alt+Q working too.
 */
export function CtrlTSetup(props: CtrlTSetupProps) {
  return (
    <div class={styles.setup} aria-live="polite">
      <Show
        when={opensWithNewTabKey(props.shortcuts)}
        fallback={
          <>
            <p class={styles.text}>{i18n.t('ctrlTBody')}</p>
            <ol class={styles.steps}>
              <li>{i18n.t('ctrlTStepOpen')}</li>
              <li>{i18n.t('ctrlTStepSet', [i18n.t('commandOpenSecond')])}</li>
            </ol>
            <div class={styles.actions}>
              <Button variant="primary" onClick={() => props.onSetUp()}>
                {i18n.t('ctrlTButton')}
              </Button>
              <span class={styles.note}>{i18n.t('ctrlTNote')}</span>
            </div>
          </>
        }
      >
        <p class={styles.done}>{i18n.t('ctrlTDone')}</p>
      </Show>
    </div>
  )
}
