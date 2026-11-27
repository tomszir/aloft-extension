import { createSignal, Show } from 'solid-js'
import { i18n } from '#i18n'
import { type Release, releasesBetween } from '../../core/changelog'
import type { Keyword } from '../../core/keywords'
import type { Settings as SettingsValue } from '../../core/settings'
import type { Shortcuts } from '../../core/shortcut'
import {
  DEFAULT_DARK_THEME_ID,
  DEFAULT_LIGHT_THEME_ID,
  importTheme,
  makeThemeId,
  PRESET_THEMES,
  resolveTheme,
  type Theme,
} from '../../core/theme'
import { FONTS, type Font } from '../../core/typography'
import { Button } from '../button/button'
import { Choice } from '../choice/choice'
import { CtrlTSetup } from '../ctrl-t-setup/ctrl-t-setup'
import type { FaviconLoader } from '../favicon/favicon'
import { KeywordSettings } from '../keyword-settings/keyword-settings'
import { Logo } from '../logo/logo'
import { ReleaseNotes } from '../release-notes/release-notes'
import { SettingsPreview } from '../settings-preview/settings-preview'
import { ShortcutSentence } from '../shortcut-sentence/shortcut-sentence'
import { ThemeEditor } from '../theme-editor/theme-editor'
import { ThemePicker } from '../theme-picker/theme-picker'
import { Toggle } from '../toggle/toggle'
import styles from './settings.module.css'

export interface SettingsProps {
  settings: SettingsValue
  onChange: (change: (current: SettingsValue) => SettingsValue) => void
  shortcuts: Shortcuts
  onChangeShortcut: () => void
  /** The palette itself, in preview mode, so it shows exactly what Aloft will. */
  previewSrc: string
  keywords: readonly Keyword[]
  onKeywordsChange: (keywords: Keyword[]) => Promise<boolean>
  favicon: FaviconLoader
  /** Clears every learned pick on this device. */
  onForgetPicks: () => Promise<void>
  /** The installed version and every release's notes, newest first. */
  version: string
  releases: readonly Release[]
  /** The version Aloft was updated from, when that's news to this person. */
  updatedFrom?: string | undefined
  customThemes: readonly Theme[]
  /** False, saving nothing, when they don't fit in sync storage. */
  onSaveThemes: (themes: readonly Theme[]) => Promise<boolean>
  onExportTheme: (theme: Theme) => void
}

type Scheme = 'light' | 'dark'

const FONT_LABEL: Record<Font, () => string> = {
  system: () => i18n.t('settingsFontSystem'),
  sans: () => i18n.t('settingsFontSans'),
  serif: () => i18n.t('settingsFontSerif'),
  rounded: () => i18n.t('settingsFontRounded'),
  mono: () => i18n.t('settingsFontMono'),
  custom: () => i18n.t('settingsFontCustom'),
}

const IMPORT_ERROR: Record<'too-large' | 'not-json' | 'invalid', () => string> = {
  'too-large': () => i18n.t('themeImportTooLarge'),
  'not-json': () => i18n.t('themeImportNotJson'),
  invalid: () => i18n.t('themeImportInvalid'),
}

type Sources = SettingsValue['sources']
type Appearance = SettingsValue['appearance']

const SOURCES: readonly { key: keyof Sources; label: () => string }[] = [
  { key: 'tabs', label: () => i18n.t('sectionOpenTabs') },
  { key: 'history', label: () => i18n.t('sectionHistory') },
  { key: 'bookmarks', label: () => i18n.t('sectionBookmarks') },
  { key: 'recentlyClosed', label: () => i18n.t('sectionRecentlyClosed') },
]

export function Settings(props: SettingsProps) {
  const set = <K extends keyof SettingsValue>(key: K, value: SettingsValue[K]) =>
    props.onChange((current) => ({ ...current, [key]: value }))
  const setSource = (key: keyof Sources, on: boolean) =>
    props.onChange((current) => ({ ...current, sources: { ...current.sources, [key]: on } }))
  const setAppearance = <K extends keyof Appearance>(key: K, value: Appearance[K]) =>
    props.onChange((current) => ({
      ...current,
      appearance: { ...current.appearance, [key]: value },
    }))
  const scheme = () => props.settings.appearance.colorScheme
  const [forgotten, setForgotten] = createSignal(false)
  const forgetPicks = async () => {
    await props.onForgetPicks()
    setForgotten(true)
  }

  const allThemes = () => [...PRESET_THEMES, ...props.customThemes]
  const themesFor = (s: Scheme) => allThemes().filter((t) => t.scheme === s)
  const selectedId = (s: Scheme) =>
    s === 'light' ? props.settings.appearance.lightTheme : props.settings.appearance.darkTheme
  const selected = (s: Scheme) =>
    resolveTheme({ ...props.settings.appearance, colorScheme: s }, s === 'dark', allThemes())
  const isCustom = (theme: Theme) => props.customThemes.some((t) => t.id === theme.id)
  const takenIds = () => new Set(allThemes().map((t) => t.id))

  // A theme being edited stays a draft, shown only in the preview, until it's saved.
  const [editing, setEditing] = createSignal<{ theme: Theme; saved: boolean }>()
  const [themeError, setThemeError] = createSignal<string>()
  const edit = (theme: Theme, saved: boolean) => {
    setThemeError(undefined)
    setEditing({ theme, saved })
  }
  const customize = (s: Scheme) => {
    const base = selected(s)
    if (isCustom(base)) return edit(base, true)
    const name = i18n.t('themeCopyName', [base.name]).slice(0, 40)
    edit({ ...base, id: makeThemeId(name, takenIds()), name }, false)
  }
  const select = (theme: Theme) =>
    setAppearance(theme.scheme === 'light' ? 'lightTheme' : 'darkTheme', theme.id)
  const saveEditing = async () => {
    const current = editing()
    if (!current) return
    const theme = { ...current.theme, name: current.theme.name.trim() }
    const exists = props.customThemes.some((t) => t.id === theme.id)
    const next = exists
      ? props.customThemes.map((t) => (t.id === theme.id ? theme : t))
      : [...props.customThemes, theme]
    if (!(await props.onSaveThemes(next))) {
      setThemeError(i18n.t('themeTooMany'))
      return
    }
    select(theme)
    setEditing(undefined)
  }
  const deleteEditing = async () => {
    const current = editing()
    if (!current) return
    const { id, scheme: s } = current.theme
    await props.onSaveThemes(props.customThemes.filter((t) => t.id !== id))
    // Back to the built-in theme rather than whichever one would be found next.
    if (selectedId(s) === id)
      setAppearance(
        s === 'light' ? 'lightTheme' : 'darkTheme',
        s === 'light' ? DEFAULT_LIGHT_THEME_ID : DEFAULT_DARK_THEME_ID,
      )
    setEditing(undefined)
  }
  // An imported theme opens in the editor, so it's seen in the preview first.
  const [importError, setImportError] = createSignal<string>()
  let importInput: HTMLInputElement | undefined
  const importFile = async (file: File) => {
    setImportError(undefined)
    const result = importTheme(await file.text())
    if (!result.ok) {
      setImportError(IMPORT_ERROR[result.error]())
      return
    }
    edit({ ...result.theme, id: makeThemeId(result.theme.name, takenIds()) }, false)
  }

  // What changed since the version this person had, or else the latest
  // release; everything older waits behind a disclosure.
  const fresh = () =>
    props.updatedFrom === undefined
      ? []
      : releasesBetween(props.releases, props.updatedFrom, props.version)
  const shown = () => {
    const releases = fresh()
    return releases.length > 0 ? releases : props.releases.slice(0, 1)
  }
  const earlier = () => props.releases.filter((r) => !shown().includes(r))

  return (
    <div class={styles.layout}>
      <header class={styles.top}>
        <div class={styles.header}>
          <Logo label={i18n.t('extShortName')} />
          <h1 class={styles.title}>{i18n.t('settingsTitle')}</h1>
        </div>
        <Show when={fresh().length > 0}>
          <p class={styles.updated}>
            {i18n.t('settingsUpdated', [props.version])}{' '}
            <a href="#whats-new">{i18n.t('settingsSeeWhatsNew')}</a>
          </p>
        </Show>
      </header>
      <main class={styles.page}>
        <section class={styles.card} aria-labelledby="al-opening-title">
          <h2 id="al-opening-title" class={styles.heading}>
            {i18n.t('settingsOpening')}
          </h2>
          <div class={styles.shortcut}>
            <ShortcutSentence shortcut={props.shortcuts.main} class={styles.text} />
            <Button onClick={() => props.onChangeShortcut()}>
              {i18n.t('onboardingChangeShortcut')}
            </Button>
          </div>
          <CtrlTSetup shortcuts={props.shortcuts} onSetUp={props.onChangeShortcut} />
        </section>

        <section class={styles.card} aria-labelledby="al-results-title">
          <h2 id="al-results-title" class={styles.heading}>
            {i18n.t('settingsResults')}
          </h2>
          <Choice
            label={i18n.t('settingsEnterOpensIn')}
            options={[
              { value: 'new-tab', label: i18n.t('settingsEnterNewTab') },
              { value: 'current-tab', label: i18n.t('settingsEnterCurrentTab') },
            ]}
            value={props.settings.enterOpensIn}
            onChange={(value) => set('enterOpensIn', value)}
            note={i18n.t('settingsEnterNote')}
          />
          <Toggle
            label={i18n.t('settingsSwitchToOpenTabs')}
            checked={props.settings.switchToOpenTabs}
            onChange={(on) => set('switchToOpenTabs', on)}
          />
          <Toggle
            label={i18n.t('settingsLearnFromPicks')}
            checked={props.settings.learnFromPicks}
            onChange={(on) => set('learnFromPicks', on)}
            note={
              <div class={styles.noteBody}>
                <span>{i18n.t('settingsLearnFromPicksNote')}</span>
                <div class={styles.forget}>
                  <Button onClick={() => void forgetPicks()}>
                    {i18n.t('settingsForgetPicks')}
                  </Button>
                  <span aria-live="polite">
                    {forgotten() ? i18n.t('settingsPicksForgotten') : ''}
                  </span>
                </div>
              </div>
            }
          />
          <Toggle
            label={i18n.t('settingsShowPinned')}
            checked={props.settings.pinned.showInAloft}
            onChange={(on) => set('pinned', { showInAloft: on })}
          />
          <fieldset class={styles.group}>
            <legend class={styles.legend}>{i18n.t('settingsSources')}</legend>
            {SOURCES.map((source) => (
              <Toggle
                label={source.label()}
                checked={props.settings.sources[source.key]}
                onChange={(on) => setSource(source.key, on)}
              />
            ))}
          </fieldset>
        </section>

        <section class={styles.card} aria-labelledby="al-keywords-title">
          <div class={styles.intro}>
            <h2 id="al-keywords-title" class={styles.heading}>
              {i18n.t('settingsKeywords')}
            </h2>
            <p class={styles.note}>{i18n.t('settingsKeywordsNote')}</p>
          </div>
          <KeywordSettings
            keywords={props.keywords}
            favicon={props.favicon}
            onChange={props.onKeywordsChange}
          />
        </section>

        <section class={styles.card} aria-labelledby="al-appearance-title">
          <h2 id="al-appearance-title" class={styles.heading}>
            {i18n.t('settingsAppearance')}
          </h2>
          <Choice
            label={i18n.t('settingsColorScheme')}
            options={[
              { value: 'system', label: i18n.t('settingsSchemeSystem') },
              { value: 'light', label: i18n.t('settingsSchemeLight') },
              { value: 'dark', label: i18n.t('settingsSchemeDark') },
            ]}
            value={scheme()}
            onChange={(value) => setAppearance('colorScheme', value)}
          />
          <Show when={scheme() !== 'dark'}>
            <ThemePicker
              label={i18n.t('settingsLightTheme')}
              themes={themesFor('light')}
              value={selectedId('light')}
              onChange={(id) => setAppearance('lightTheme', id)}
            />
            <Show
              when={editing()?.theme.scheme === 'light' && editing()}
              fallback={
                <div class={styles.themeActions}>
                  <Button onClick={() => customize('light')}>
                    {isCustom(selected('light')) ? i18n.t('themeEdit') : i18n.t('themeCustomize')}
                  </Button>
                </div>
              }
            >
              {(current) => (
                <ThemeEditor
                  theme={current().theme}
                  saved={current().saved}
                  error={themeError()}
                  onChange={(theme) => setEditing({ ...current(), theme })}
                  onSave={() => void saveEditing()}
                  onCancel={() => setEditing(undefined)}
                  onDelete={() => void deleteEditing()}
                  onExport={() => props.onExportTheme(current().theme)}
                />
              )}
            </Show>
          </Show>
          <Show when={scheme() !== 'light'}>
            <ThemePicker
              label={i18n.t('settingsDarkTheme')}
              themes={themesFor('dark')}
              value={selectedId('dark')}
              onChange={(id) => setAppearance('darkTheme', id)}
            />
            <Show
              when={editing()?.theme.scheme === 'dark' && editing()}
              fallback={
                <div class={styles.themeActions}>
                  <Button onClick={() => customize('dark')}>
                    {isCustom(selected('dark')) ? i18n.t('themeEdit') : i18n.t('themeCustomize')}
                  </Button>
                </div>
              }
            >
              {(current) => (
                <ThemeEditor
                  theme={current().theme}
                  saved={current().saved}
                  error={themeError()}
                  onChange={(theme) => setEditing({ ...current(), theme })}
                  onSave={() => void saveEditing()}
                  onCancel={() => setEditing(undefined)}
                  onDelete={() => void deleteEditing()}
                  onExport={() => props.onExportTheme(current().theme)}
                />
              )}
            </Show>
          </Show>
          <div class={styles.themeActions}>
            <Button onClick={() => importInput?.click()}>{i18n.t('themeImport')}</Button>
            <input
              ref={importInput}
              class={styles.hiddenInput}
              type="file"
              accept="application/json,.json"
              aria-label={i18n.t('themeImport')}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                event.currentTarget.value = ''
                if (file) void importFile(file)
              }}
            />
            <Show when={importError()}>
              {(error) => (
                <span class={styles.importError} role="alert">
                  {error()}
                </span>
              )}
            </Show>
          </div>
          <Choice
            label={i18n.t('settingsPosition')}
            options={[
              { value: 'upper-third', label: i18n.t('settingsPositionUpperThird') },
              { value: 'center', label: i18n.t('settingsPositionCenter') },
            ]}
            value={props.settings.appearance.position}
            onChange={(value) => setAppearance('position', value)}
          />
          <Choice
            label={i18n.t('settingsFont')}
            options={FONTS.map((font) => ({ value: font, label: FONT_LABEL[font]() }))}
            value={props.settings.appearance.font}
            onChange={(value) => setAppearance('font', value)}
            note={i18n.t('settingsFontNote')}
          />
          <Show when={props.settings.appearance.font === 'custom'}>
            <label class={styles.fontField}>
              {i18n.t('settingsFontName')}
              <input
                class={styles.fontInput}
                value={props.settings.appearance.customFont}
                maxLength={60}
                spellcheck={false}
                placeholder="Inter"
                onChange={(event) => setAppearance('customFont', event.currentTarget.value.trim())}
              />
            </label>
          </Show>
          <Choice
            label={i18n.t('settingsDensity')}
            options={[
              { value: 'compact', label: i18n.t('settingsDensityCompact') },
              { value: 'default', label: i18n.t('settingsDensityDefault') },
              { value: 'comfortable', label: i18n.t('settingsDensityComfortable') },
            ]}
            value={props.settings.appearance.density}
            onChange={(value) => setAppearance('density', value)}
          />
          <Toggle
            label={i18n.t('settingsBlur')}
            checked={props.settings.appearance.blur}
            onChange={(on) => setAppearance('blur', on)}
          />
        </section>

        <section id="whats-new" class={styles.card} aria-labelledby="al-whats-new-title">
          <div class={styles.intro}>
            <h2 id="al-whats-new-title" class={styles.heading}>
              {i18n.t('settingsWhatsNew')}
            </h2>
            <p class={styles.note}>{i18n.t('settingsVersion', [props.version])}</p>
          </div>
          <Toggle
            label={i18n.t('settingsWhatsNewInAloft')}
            checked={props.settings.whatsNewInAloft}
            onChange={(on) => set('whatsNewInAloft', on)}
            note={i18n.t('settingsWhatsNewInAloftNote')}
          />
          <ReleaseNotes
            releases={shown()}
            fresh={new Set(fresh().map((release) => release.version))}
          />
          <Show when={earlier().length > 0}>
            <details class={styles.earlier}>
              <summary>{i18n.t('settingsEarlierVersions')}</summary>
              <ReleaseNotes releases={earlier()} />
            </details>
          </Show>
        </section>
      </main>
      <aside class={styles.side}>
        <SettingsPreview
          src={props.previewSrc}
          appearance={props.settings.appearance}
          editing={editing()?.theme}
        />
      </aside>
    </div>
  )
}
