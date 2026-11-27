import { For, Show } from 'solid-js'
import { i18n } from '#i18n'
import type { Release } from '../../core/changelog'
import styles from './release-notes.module.css'

export interface ReleaseNotesProps {
  releases: readonly Release[]
  /** Versions to mark as new to this person. */
  fresh?: ReadonlySet<string>
}

// Notes are plain sentences; **bold** is the only markup they use, to flag a
// change that makes people redo something. Built as text nodes, never HTML.
function Note(props: { text: string }) {
  return (
    <For each={props.text.split('**')}>
      {(part, index) => (index() % 2 === 1 ? <strong>{part}</strong> : part)}
    </For>
  )
}

export function ReleaseNotes(props: ReleaseNotesProps) {
  return (
    <div class={styles.releases}>
      <For each={props.releases}>
        {(release) => (
          <article class={styles.release} aria-labelledby={`al-release-${release.version}`}>
            <h3 id={`al-release-${release.version}`} class={styles.heading}>
              <span>{release.version}</span>
              <span class={styles.date}>{release.date}</span>
              <Show when={props.fresh?.has(release.version)}>
                <span class={styles.badge}>{i18n.t('settingsReleaseNew')}</span>
              </Show>
            </h3>
            <For each={release.intro}>{(text) => <p class={styles.intro}>{text}</p>}</For>
            <Show when={release.notes.length > 0}>
              <ul class={styles.notes}>
                <For each={release.notes}>
                  {(text) => (
                    <li>
                      <Note text={text} />
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </article>
        )}
      </For>
    </div>
  )
}
