import { createMemo, createSignal, For, Show } from 'solid-js'
import { i18n } from '#i18n'
import {
  type Backup,
  type BackupError,
  exportBackup,
  MAX_BACKUP_BYTES,
  planRestore,
  readBackup,
  restoreChangesNothing,
} from '../../core/backup'
import type { Keyword } from '../../core/keywords'
import type { Settings } from '../../core/settings'
import type { Theme, ThemesSaved } from '../../core/theme'
import { Button } from '../button/button'
import '../icon/page-icons'
import { SettingRow } from '../setting-row/setting-row'
import styles from './backup-settings.module.css'

export interface BackupSettingsProps {
  settings: Settings
  customThemes: readonly Theme[]
  keywords: readonly Keyword[]
  /** Hands the backup's text over to be saved as a file. */
  onExport: (text: string) => void
  onChange: (change: (current: Settings) => Settings) => void
  onSaveThemes: (themes: readonly Theme[]) => Promise<ThemesSaved>
  onKeywordsChange: (keywords: Keyword[]) => Promise<boolean>
}

const READ_ERROR: Record<BackupError, () => string> = {
  'too-large': () => i18n.t('backupTooLarge'),
  'not-json': () => i18n.t('backupNotBackup'),
  invalid: () => i18n.t('backupNotBackup'),
}

/** Saving every setting, theme and keyword to a file, and restoring them from one. */
export function BackupSettings(props: BackupSettingsProps) {
  const [pending, setPending] = createSignal<Backup>()
  const [error, setError] = createSignal<string>()
  const [restored, setRestored] = createSignal(false)
  let importButton: HTMLButtonElement | undefined
  let input: HTMLInputElement | undefined

  // Worked out again from what's in use whenever that changes, such as from
  // another settings tab, so what's confirmed is what's saved.
  const plan = createMemo(() => {
    const backup = pending()
    if (!backup) return undefined
    return planRestore(backup, {
      settings: props.settings,
      themes: props.customThemes,
      keywords: props.keywords,
    })
  })

  const exportNow = () =>
    props.onExport(
      exportBackup({
        settings: props.settings,
        themes: props.customThemes,
        keywords: props.keywords,
      }),
    )

  const choose = async (file: File) => {
    setError(undefined)
    setRestored(false)
    setPending(undefined)
    // Checked before reading: a large file is never a backup.
    const result = file.size > MAX_BACKUP_BYTES ? undefined : readBackup(await file.text())
    if (!result?.ok) {
      setError(READ_ERROR[result?.error ?? 'too-large']())
      return
    }
    setPending(result.backup)
  }

  const close = () => {
    setPending(undefined)
    importButton?.focus()
  }

  // Themes first, so the settings never point at one that isn't saved; then
  // keywords; then the settings. Each goes through its usual save, which
  // keeps to what sync storage allows.
  const restore = async () => {
    const current = plan()
    if (!current) return
    setPending(undefined)
    if (current.themes && (await props.onSaveThemes(current.themes)) !== 'saved') {
      setError(i18n.t('backupFailed'))
      return
    }
    if (current.keywords) {
      const saved = await props.onKeywordsChange(current.keywords).catch(() => false)
      if (!saved) {
        setError(i18n.t('backupFailed'))
        return
      }
    }
    const settings = current.settings
    if (settings) props.onChange(() => settings)
    setRestored(true)
    importButton?.focus()
  }

  const changes = () => {
    const current = plan()
    if (!current) return []
    const s = current.summary
    const lines: string[] = []
    if (s.settings) lines.push(i18n.t('backupReplacesSettings'))
    if (s.themesAdded > 0) lines.push(i18n.t('backupThemesAdded', s.themesAdded))
    if (s.themesSkipped > 0) lines.push(i18n.t('backupThemesSkipped', s.themesSkipped))
    if (s.builtIns) lines.push(i18n.t('backupBuiltIns'))
    if (s.keywordsAdded > 0) lines.push(i18n.t('backupKeywordsAdded', s.keywordsAdded))
    if (s.keywordsSkipped > 0) lines.push(i18n.t('backupKeywordsSkipped', s.keywordsSkipped))
    if (s.keywordsSwitchedOff > 0)
      lines.push(i18n.t('backupKeywordsSwitchedOff', s.keywordsSwitchedOff))
    return lines
  }

  return (
    <>
      <SettingRow label={i18n.t('backupExport')} description={i18n.t('backupExportNote')}>
        <Button icon="download" onClick={exportNow}>
          {i18n.t('backupExportButton')}
        </Button>
      </SettingRow>
      <SettingRow
        label={i18n.t('backupImport')}
        description={
          <>
            <span aria-live="polite">
              {restored() ? i18n.t('backupRestored') : i18n.t('backupImportNote')}
            </span>
            <Show when={error()}>
              {(message) => (
                <span class={styles.error} role="alert">
                  {message()}
                </span>
              )}
            </Show>
          </>
        }
      >
        <Button ref={importButton} icon="upload" onClick={() => input?.click()}>
          {i18n.t('backupImportButton')}
        </Button>
        <input
          ref={input}
          class={styles.hiddenInput}
          type="file"
          accept="application/json,.json"
          aria-label={i18n.t('backupImport')}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (file) void choose(file)
          }}
        />
      </SettingRow>
      <Show when={plan()}>
        {(current) => (
          <div class={styles.confirm} role="alert" aria-labelledby="al-backup-ask">
            <Show
              when={!restoreChangesNothing(current())}
              fallback={
                <p id="al-backup-ask" class={styles.ask}>
                  {i18n.t('backupNothing')}
                </p>
              }
            >
              <p id="al-backup-ask" class={styles.ask}>
                {i18n.t('backupAsk')}
              </p>
              <ul class={styles.changes}>
                <For each={changes()}>{(line) => <li>{line}</li>}</For>
              </ul>
            </Show>
            <Show when={pending()?.newer}>
              <p class={styles.note}>{i18n.t('backupNewer')}</p>
            </Show>
            <div class={styles.actions}>
              <Show
                when={!restoreChangesNothing(current())}
                fallback={<Button onClick={close}>{i18n.t('backupClose')}</Button>}
              >
                <Button onClick={close}>{i18n.t('backupCancel')}</Button>
                <Button variant="primary" icon="check" onClick={() => void restore()}>
                  {i18n.t('backupRestore')}
                </Button>
              </Show>
            </div>
          </div>
        )}
      </Show>
    </>
  )
}
