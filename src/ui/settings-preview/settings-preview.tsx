import { createEffect, createSignal, on, onCleanup, Show, untrack } from 'solid-js'
import { i18n } from '#i18n'
import type { Settings } from '../../core/settings'
import { encodePreviewTheme, type Theme } from '../../core/theme'
import { Choice } from '../choice/choice'
import '../icon/page-icons'
import styles from './settings-preview.module.css'

export interface SettingsPreviewProps {
  /** The palette in preview mode, which shows real results but never acts on them. */
  src: string
  appearance: Settings['appearance']
  /** A theme being edited, shown before it's saved, in its own scheme. */
  editing?: Theme | undefined
}

function previewHash(scheme: 'light' | 'dark', editing: Theme | undefined): string {
  const params = `scheme=${editing?.scheme ?? scheme}`
  return editing ? `${params}&theme=${encodePreviewTheme(editing)}` : params
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
    if (props.editing) return props.editing.scheme
    const setting = props.appearance.colorScheme
    return setting === 'system' ? (picked() ?? systemScheme()) : setting
  }

  // Later changes go through location.replace, which only swaps the frame's
  // hash: setting its src would add a history entry for every color tried,
  // and Back would step through them. Both pages are Aloft's, so the settings
  // page may reach into the frame.
  let frame: HTMLIFrameElement | undefined
  createEffect(
    on(
      () => previewHash(scheme(), props.editing),
      (hash) => frame?.contentWindow?.location.replace(`${props.src}#${hash}`),
      { defer: true },
    ),
  )

  return (
    <section class={styles.preview} aria-label={i18n.t('settingsPreview')}>
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
          ref={frame}
          class={styles.frame}
          src={`${props.src}#${untrack(() => previewHash(scheme(), props.editing))}`}
          title={i18n.t('settingsPreview')}
          style={{
            'color-scheme': 'light dark',
            'backdrop-filter': props.appearance.blur ? 'blur(4px)' : 'none',
          }}
        />
        {/* The preview's own controls float over it, out of the settings. */}
        <div class={styles.panel}>
          <span class={styles.caption}>
            {props.editing
              ? props.editing.name.trim()
                ? i18n.t('settingsPreviewEditing', [props.editing.name.trim()])
                : i18n.t('settingsPreviewEditingUnnamed')
              : i18n.t('settingsPreviewNote')}
          </span>
          <Show when={props.appearance.colorScheme === 'system' && !props.editing}>
            <span id="al-preview-scheme" class={styles.hidden}>
              {i18n.t('settingsPreviewScheme')}
            </span>
            <Choice
              label={i18n.t('settingsPreviewScheme')}
              labelledBy="al-preview-scheme"
              options={[
                { value: 'light', label: i18n.t('settingsSchemeLight'), icon: 'sun' },
                { value: 'dark', label: i18n.t('settingsSchemeDark'), icon: 'moon' },
              ]}
              value={scheme()}
              onChange={setPicked}
            />
          </Show>
        </div>
      </div>
    </section>
  )
}
