import { createSignal, onCleanup, Show } from 'solid-js'
import { i18n } from '#i18n'
import type { Settings } from '../../core/settings'
import { Choice } from '../choice/choice'
import styles from './settings-preview.module.css'

export interface SettingsPreviewProps {
  /** The palette in preview mode, which shows real results but never acts on them. */
  src: string
  appearance: Settings['appearance']
}

type Scheme = 'light' | 'dark'

/**
 * The palette as it opens over a page: its frame drawn like the overlay's,
 * dimmed and blurred over a stand-in page, at the size the frame really has.
 */
export function SettingsPreview(props: SettingsPreviewProps) {
  const query = matchMedia('(prefers-color-scheme: dark)')
  const [systemScheme, setSystemScheme] = createSignal<Scheme>(query.matches ? 'dark' : 'light')
  const onChange = (event: MediaQueryListEvent) => setSystemScheme(event.matches ? 'dark' : 'light')
  query.addEventListener('change', onChange)
  onCleanup(() => query.removeEventListener('change', onChange))

  // With "Match system", either theme can show; the switch picks which one
  // the preview shows without changing the setting.
  const [picked, setPicked] = createSignal<Scheme>()
  const scheme = (): Scheme => {
    const setting = props.appearance.colorScheme
    return setting === 'system' ? (picked() ?? systemScheme()) : setting
  }

  return (
    <section class={styles.preview} aria-labelledby="al-preview-title">
      <div class={styles.header}>
        <div class={styles.intro}>
          <h2 id="al-preview-title" class={styles.heading}>
            {i18n.t('settingsPreview')}
          </h2>
          <p class={styles.note}>{i18n.t('settingsPreviewNote')}</p>
        </div>
        <Show when={props.appearance.colorScheme === 'system'}>
          <Choice
            label={i18n.t('settingsPreviewScheme')}
            options={[
              { value: 'light', label: i18n.t('settingsSchemeLight') },
              { value: 'dark', label: i18n.t('settingsSchemeDark') },
            ]}
            value={scheme()}
            onChange={setPicked}
          />
        </Show>
      </div>
      <div class={styles.stage} data-scheme={scheme()}>
        <div class={styles.page} aria-hidden="true">
          <div class={styles.bar} />
          <div class={styles.lines}>
            <div class={styles.heading} />
            <div class={styles.line} />
            <div class={styles.line} />
            <div class={styles.short} />
            <div class={styles.block} />
            <div class={styles.line} />
            <div class={styles.short} />
          </div>
        </div>
        {/* Like the overlay's frame: transparent, "light dark" on both sides
            (anything else and Chrome paints the frame opaque), and the blur
            outside. The scheme goes in the hash, which changes the preview's
            theme without reloading it. */}
        <iframe
          class={styles.frame}
          src={`${props.src}#${scheme()}`}
          title={i18n.t('settingsPreview')}
          style={{
            'color-scheme': 'light dark',
            'backdrop-filter': props.appearance.blur ? 'blur(4px)' : 'none',
          }}
        />
      </div>
    </section>
  )
}
