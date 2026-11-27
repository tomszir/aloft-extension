import { createEffect, createSignal, For, on, Show } from 'solid-js'
import { i18n } from '#i18n'
import { type Release, releasesBetween } from '../../core/changelog'
import type { Keyword } from '../../core/keywords'
import { AUTHOR, LINKS } from '../../core/links'
import type { Settings as SettingsValue } from '../../core/settings'
import type { Shortcuts } from '../../core/shortcut'
import {
  DEFAULT_DARK_THEME_ID,
  DEFAULT_LIGHT_THEME_ID,
  importTheme,
  MAX_CUSTOM_THEMES,
  MAX_IMPORT_BYTES,
  makeThemeId,
  PRESET_THEMES,
  resolveTheme,
  type Theme,
  type ThemesSaved,
  uniqueName,
} from '../../core/theme'
import { FONTS, type Font, isFontName } from '../../core/typography'
import { Button } from '../button/button'
import { Choice } from '../choice/choice'
import { CtrlTSetup, newTabKey } from '../ctrl-t-setup/ctrl-t-setup'
import type { FaviconLoader } from '../favicon/favicon'
import { Icon } from '../icon/icon'
import type { IconName } from '../icon/icons'
import '../icon/page-icons'
import { KeywordSettings } from '../keyword-settings/keyword-settings'
import { Logo } from '../logo/logo'
import { slideHighlight } from '../motion/slide'
import { ReleaseNotes } from '../release-notes/release-notes'
import { SettingRow } from '../setting-row/setting-row'
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
  onSaveThemes: (themes: readonly Theme[]) => Promise<ThemesSaved>
  onExportTheme: (theme: Theme) => void
}

type Scheme = 'light' | 'dark'

// How far below the column's top a section's title may be and still count as
// the one being read.
const SECTION_LEAD = 96
// Longer than any smooth scroll the browser runs.
const JUMP_TIMEOUT_MS = 1000

const smoothScroll = (): ScrollBehavior =>
  matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'

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

const SECTIONS: readonly { id: string; icon: IconName; label: () => string }[] = [
  { id: 'opening', icon: 'keyboard', label: () => i18n.t('settingsOpening') },
  { id: 'results', icon: 'list', label: () => i18n.t('settingsResults') },
  { id: 'sources', icon: 'layers', label: () => i18n.t('settingsSources') },
  { id: 'keywords', icon: 'at-sign', label: () => i18n.t('settingsKeywords') },
  { id: 'appearance', icon: 'palette', label: () => i18n.t('settingsAppearance') },
  { id: 'privacy', icon: 'shield-check', label: () => i18n.t('settingsPrivacy') },
  { id: 'whats-new', icon: 'sparkles', label: () => i18n.t('settingsWhatsNew') },
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
  const [fontRejected, setFontRejected] = createSignal(false)
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
  const takenIds = () => new Set(allThemes().map((t) => t.id))

  // A theme being edited stays a draft, shown only in the preview, until it's
  // saved. `original` is what it was when the editor opened, to tell whether
  // leaving would lose changes.
  const [editing, setEditing] = createSignal<{ theme: Theme; original: Theme; saved: boolean }>()
  const [themeError, setThemeError] = createSignal<string>()
  // Said once a theme is saved: which slot it went into, which can be a
  // picker the color scheme hides.
  const [savedNote, setSavedNote] = createSignal<string>()
  // The editor takes over the column; leaving it comes back to where the
  // themes are, with focus on the control that opened it.
  let column: HTMLDivElement | undefined
  let opener: HTMLElement | undefined
  const edit = (theme: Theme, saved: boolean) => {
    setThemeError(undefined)
    setSavedNote(undefined)
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
    setEditing({ theme, original: theme, saved })
    column?.scrollTo({ top: 0 })
    requestAnimationFrame(() => document.getElementById('al-theme-editor-title')?.focus())
  }
  const closeEditor = () => {
    setEditing(undefined)
    requestAnimationFrame(() => {
      if (opener?.isConnected) opener.focus({ preventScroll: true })
      else document.getElementById('al-appearance-title')?.focus({ preventScroll: true })
      document.getElementById('appearance')?.scrollIntoView()
    })
  }
  const atLimit = () => props.customThemes.length >= MAX_CUSTOM_THEMES
  const customIds = () => new Set(props.customThemes.map((t) => t.id))
  // A new theme starts as a copy of the one in use, which is easier to adjust
  // than a blank one.
  const newFrom = (s: Scheme) => {
    const base = selected(s)
    const name = i18n.t('themeCopyName', [base.name]).slice(0, 40)
    edit({ ...base, id: makeThemeId(name, takenIds()), name }, false)
  }
  const select = (theme: Theme) =>
    setAppearance(theme.scheme === 'light' ? 'lightTheme' : 'darkTheme', theme.id)
  const saveFailure = (result: ThemesSaved) =>
    result === 'full' ? i18n.t('themeTooMany') : i18n.t('themeSaveFailed')
  const saveEditing = async () => {
    const current = editing()
    if (!current) return
    let theme = { ...current.theme, name: current.theme.name.trim() }
    // A new theme's id was picked when the editor opened; another settings
    // tab may have saved one under it since, which this would overwrite.
    if (!current.saved && props.customThemes.some((t) => t.id === theme.id))
      theme = { ...theme, id: makeThemeId(theme.name, takenIds()) }
    const exists = props.customThemes.some((t) => t.id === theme.id)
    const next = exists
      ? props.customThemes.map((t) => (t.id === theme.id ? theme : t))
      : [...props.customThemes, theme]
    const result = await props.onSaveThemes(next)
    if (result !== 'saved') {
      setThemeError(saveFailure(result))
      return
    }
    select(theme)
    closeEditor()
    setSavedNote(
      i18n.t(theme.scheme === 'dark' ? 'themeSavedDark' : 'themeSavedLight', [theme.name]),
    )
  }
  const deleteEditing = async () => {
    const current = editing()
    if (!current) return
    const { id, scheme: s } = current.theme
    const result = await props.onSaveThemes(props.customThemes.filter((t) => t.id !== id))
    if (result !== 'saved') {
      setThemeError(i18n.t('themeSaveFailed'))
      return
    }
    // Back to the built-in theme rather than whichever one would be found next.
    if (selectedId(s) === id)
      setAppearance(
        s === 'light' ? 'lightTheme' : 'darkTheme',
        s === 'light' ? DEFAULT_LIGHT_THEME_ID : DEFAULT_DARK_THEME_ID,
      )
    closeEditor()
  }
  // An imported theme opens in the editor, so it's seen in the preview first.
  const [importError, setImportError] = createSignal<string>()
  let importInput: HTMLInputElement | undefined
  const importFile = async (file: File) => {
    setImportError(undefined)
    // Checked before reading: a large file is never a theme.
    const result = file.size > MAX_IMPORT_BYTES ? undefined : importTheme(await file.text())
    if (!result?.ok) {
      const error = result?.error ?? 'too-large'
      // The field that's wrong, from the schema check, so the file can be fixed.
      setImportError(
        error === 'invalid' && result && !result.ok
          ? i18n.t('themeImportInvalidField', [result.message])
          : IMPORT_ERROR[error](),
      )
      return
    }
    const name = uniqueName(result.theme.name, allThemes())
    edit({ ...result.theme, name, id: makeThemeId(name, takenIds()) }, false)
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

  // The section at the top of the settings column, marked in the menu. Read
  // from scroll positions rather than observed, so a short last section can
  // still become current once the column is scrolled to its end.
  const [current, setCurrent] = createSignal(SECTIONS[0]?.id)
  // A jump scrolls smoothly past other sections; the menu keeps the one
  // picked until the scroll ends rather than flickering through them.
  let jumping = false
  const trackSection = () => {
    if (!column || jumping) return
    const top = column.getBoundingClientRect().top
    const atEnd = column.scrollTop + column.clientHeight >= column.scrollHeight - 2
    let found = SECTIONS[0]?.id
    for (const section of SECTIONS) {
      const element = document.getElementById(section.id)
      if (element && element.getBoundingClientRect().top - top <= SECTION_LEAD) found = section.id
    }
    setCurrent(atEnd ? SECTIONS.at(-1)?.id : found)
  }
  const jumpTo = (id: string) => {
    const target = document.getElementById(id)
    if (!target) return
    // Keyboard focus goes along, so the next Tab is in that section.
    target.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
    jumping = true
    setCurrent(id)
    const done = () => {
      jumping = false
    }
    column?.addEventListener('scrollend', done, { once: true })
    // Where nothing scrolls (already there), no scrollend comes.
    setTimeout(done, JUMP_TIMEOUT_MS)
    target.scrollIntoView({ behavior: smoothScroll(), block: 'start' })
  }
  let menu: HTMLElement | undefined
  let marked: Element | undefined
  createEffect(
    on(current, (id) => {
      const now = menu?.querySelector(`[href="#${id}"]`) ?? undefined
      if (marked?.isConnected && now) slideHighlight(marked, now, '--al-duration-move')
      marked = now
    }),
  )

  const list = () => (
    <>
      <header class={styles.header}>
        <div class={styles.brand}>
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

      <main class={styles.sections}>
        <section id="opening" class={styles.section} aria-labelledby="al-opening-title">
          <h2 id="al-opening-title" class={styles.sectionTitle} tabIndex={-1}>
            <span class={styles.sectionIcon}>
              <Icon name="keyboard" />
            </span>
            <span class={styles.sectionLabel}>{i18n.t('settingsOpening')}</span>
          </h2>
          <div class={styles.group}>
            <SettingRow
              label={i18n.t('settingsShortcut')}
              description={
                <ShortcutSentence shortcut={props.shortcuts.main} class={styles.plain} />
              }
            >
              <Button icon="pencil" onClick={() => props.onChangeShortcut()}>
                {i18n.t('onboardingChangeShortcut')}
              </Button>
            </SettingRow>
            <SettingRow label={i18n.t('onboardingCtrlTTitle', [newTabKey()])} stacked>
              <CtrlTSetup shortcuts={props.shortcuts} onSetUp={props.onChangeShortcut} />
            </SettingRow>
          </div>
        </section>

        <section id="results" class={styles.section} aria-labelledby="al-results-title">
          <h2 id="al-results-title" class={styles.sectionTitle} tabIndex={-1}>
            <span class={styles.sectionIcon}>
              <Icon name="list" />
            </span>
            <span class={styles.sectionLabel}>{i18n.t('settingsResults')}</span>
          </h2>
          <div class={styles.group}>
            <SettingRow
              label={i18n.t('settingsEnterOpensIn')}
              labelId="al-enter-opens-in"
              description={i18n.t('settingsEnterNote')}
              descriptionId="al-enter-opens-in-note"
            >
              <Choice
                label={i18n.t('settingsEnterOpensIn')}
                labelledBy="al-enter-opens-in"
                describedBy="al-enter-opens-in-note"
                options={[
                  { value: 'new-tab', label: i18n.t('settingsEnterNewTab') },
                  { value: 'current-tab', label: i18n.t('settingsEnterCurrentTab') },
                ]}
                value={props.settings.enterOpensIn}
                onChange={(value) => set('enterOpensIn', value)}
              />
            </SettingRow>
            <Toggle
              label={i18n.t('settingsSwitchToOpenTabs')}
              checked={props.settings.switchToOpenTabs}
              onChange={(on) => set('switchToOpenTabs', on)}
            />
            <Toggle
              label={i18n.t('settingsShowPinned')}
              checked={props.settings.pinned.showInAloft}
              onChange={(on) => set('pinned', { showInAloft: on })}
            />
          </div>
        </section>

        <section id="sources" class={styles.section} aria-labelledby="al-sources-title">
          <h2 id="al-sources-title" class={styles.sectionTitle} tabIndex={-1}>
            <span class={styles.sectionIcon}>
              <Icon name="layers" />
            </span>
            <span class={styles.sectionLabel}>{i18n.t('settingsSources')}</span>
          </h2>
          <div class={styles.group}>
            <For each={SOURCES}>
              {(source) => (
                <Toggle
                  label={source.label()}
                  checked={props.settings.sources[source.key]}
                  onChange={(on) => setSource(source.key, on)}
                />
              )}
            </For>
          </div>
        </section>

        <section id="keywords" class={styles.section} aria-labelledby="al-keywords-title">
          <div class={styles.sectionHead}>
            <h2 id="al-keywords-title" class={styles.sectionTitle} tabIndex={-1}>
              <span class={styles.sectionIcon}>
                <Icon name="at-sign" />
              </span>
              <span class={styles.sectionLabel}>{i18n.t('settingsKeywords')}</span>
            </h2>
            <p class={styles.sectionNote}>{i18n.t('settingsKeywordsNote')}</p>
          </div>
          <div class={`${styles.group} ${styles.flush}`}>
            <KeywordSettings
              keywords={props.keywords}
              favicon={props.favicon}
              onChange={props.onKeywordsChange}
            />
          </div>
        </section>

        <section id="appearance" class={styles.section} aria-labelledby="al-appearance-title">
          <div class={styles.sectionHead}>
            <h2 id="al-appearance-title" class={styles.sectionTitle} tabIndex={-1}>
              <span class={styles.sectionIcon}>
                <Icon name="palette" />
              </span>
              <span class={styles.sectionLabel}>{i18n.t('settingsAppearance')}</span>
            </h2>
            <Button
              class={styles.headAction}
              icon="upload"
              disabled={atLimit()}
              onClick={() => importInput?.click()}
            >
              {i18n.t('themeImport')}
            </Button>
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
          </div>
          <Show when={importError()}>
            {(error) => (
              <p class={styles.importError} role="alert">
                {error()}
              </p>
            )}
          </Show>
          <Show when={atLimit()}>
            <p class={styles.sectionNote}>{i18n.t('themeAtLimit')}</p>
          </Show>
          <p class={styles.savedNote} role="status">
            {savedNote() ?? ''}
          </p>
          <div class={styles.group}>
            <SettingRow label={i18n.t('settingsColorScheme')} labelId="al-color-scheme">
              <Choice
                label={i18n.t('settingsColorScheme')}
                labelledBy="al-color-scheme"
                options={[
                  { value: 'system', label: i18n.t('settingsSchemeSystem'), icon: 'monitor' },
                  { value: 'light', label: i18n.t('settingsSchemeLight'), icon: 'sun' },
                  { value: 'dark', label: i18n.t('settingsSchemeDark'), icon: 'moon' },
                ]}
                value={scheme()}
                onChange={(value) => setAppearance('colorScheme', value)}
              />
            </SettingRow>
            <For
              each={(['light', 'dark'] as const).filter(
                (s) => scheme() === 'system' || scheme() === s,
              )}
            >
              {(s) => (
                <SettingRow
                  label={s === 'light' ? i18n.t('settingsLightTheme') : i18n.t('settingsDarkTheme')}
                  labelId={`al-${s}-theme`}
                  description={selected(s).name}
                  stacked
                >
                  <ThemePicker
                    label={
                      s === 'light' ? i18n.t('settingsLightTheme') : i18n.t('settingsDarkTheme')
                    }
                    labelledBy={`al-${s}-theme`}
                    themes={themesFor(s)}
                    value={selectedId(s)}
                    onChange={(id) => setAppearance(s === 'light' ? 'lightTheme' : 'darkTheme', id)}
                    customIds={customIds()}
                    onEdit={(theme) => edit(theme, true)}
                    onNew={atLimit() ? undefined : () => newFrom(s)}
                  />
                </SettingRow>
              )}
            </For>
          </div>
          <div class={styles.group}>
            <SettingRow label={i18n.t('settingsPosition')} labelId="al-position">
              <Choice
                label={i18n.t('settingsPosition')}
                labelledBy="al-position"
                options={[
                  { value: 'upper-third', label: i18n.t('settingsPositionUpperThird') },
                  { value: 'center', label: i18n.t('settingsPositionCenter') },
                ]}
                value={props.settings.appearance.position}
                onChange={(value) => setAppearance('position', value)}
              />
            </SettingRow>
            <SettingRow label={i18n.t('settingsDensity')} labelId="al-density">
              <Choice
                label={i18n.t('settingsDensity')}
                labelledBy="al-density"
                options={[
                  { value: 'compact', label: i18n.t('settingsDensityCompact') },
                  { value: 'default', label: i18n.t('settingsDensityDefault') },
                  { value: 'comfortable', label: i18n.t('settingsDensityComfortable') },
                ]}
                value={props.settings.appearance.density}
                onChange={(value) => setAppearance('density', value)}
              />
            </SettingRow>
            <SettingRow
              label={i18n.t('settingsFont')}
              labelId="al-font"
              description={i18n.t('settingsFontNote')}
              descriptionId="al-font-note"
            >
              <select
                class={styles.select}
                aria-labelledby="al-font"
                aria-describedby="al-font-note"
                value={props.settings.appearance.font}
                onChange={(event) => setAppearance('font', event.currentTarget.value as Font)}
              >
                <For each={FONTS}>
                  {(font) => <option value={font}>{FONT_LABEL[font]()}</option>}
                </For>
              </select>
              <Show when={props.settings.appearance.font === 'custom'}>
                <input
                  class={styles.textInput}
                  value={props.settings.appearance.customFont}
                  maxLength={60}
                  spellcheck={false}
                  placeholder={i18n.t('settingsFontName')}
                  aria-label={i18n.t('settingsFontName')}
                  aria-invalid={fontRejected() || undefined}
                  aria-describedby={fontRejected() ? 'al-font-error' : undefined}
                  onChange={(event) => {
                    const name = event.currentTarget.value.trim()
                    // Only names that can't break out of the CSS they go in.
                    const ok = isFontName(name)
                    setFontRejected(!ok)
                    if (ok) setAppearance('customFont', name)
                  }}
                />
                <Show when={fontRejected()}>
                  <p id="al-font-error" class={styles.importError} role="alert">
                    {i18n.t('settingsFontNameInvalid')}
                  </p>
                </Show>
              </Show>
            </SettingRow>
            <Toggle
              label={i18n.t('settingsBlur')}
              checked={props.settings.appearance.blur}
              onChange={(on) => setAppearance('blur', on)}
            />
          </div>
        </section>

        <section id="privacy" class={styles.section} aria-labelledby="al-privacy-title">
          <h2 id="al-privacy-title" class={styles.sectionTitle} tabIndex={-1}>
            <span class={styles.sectionIcon}>
              <Icon name="shield-check" />
            </span>
            <span class={styles.sectionLabel}>{i18n.t('settingsPrivacy')}</span>
          </h2>
          <div class={styles.group}>
            <SettingRow
              label={i18n.t('settingsPrivacyLocal')}
              description={i18n.t('settingsPrivacyLocalNote')}
            />
            <SettingRow
              label={i18n.t('settingsPrivacyRead')}
              description={i18n.t('settingsPrivacyReadNote')}
            />
            <SettingRow
              label={i18n.t('settingsPrivacySync')}
              description={i18n.t('settingsPrivacySyncNote')}
            />
            <Toggle
              label={i18n.t('settingsLearnFromPicks')}
              checked={props.settings.learnFromPicks}
              onChange={(on) => set('learnFromPicks', on)}
              note={i18n.t('settingsLearnFromPicksNote')}
            />
            <SettingRow
              label={i18n.t('settingsForgetPicks')}
              description={
                <span aria-live="polite">
                  {forgotten()
                    ? i18n.t('settingsPicksForgotten')
                    : i18n.t('settingsForgetPicksNote')}
                </span>
              }
            >
              <Button icon="trash-2" onClick={() => void forgetPicks()}>
                {i18n.t('settingsForgetPicksButton')}
              </Button>
            </SettingRow>
            <div class={styles.links}>
              <a href={LINKS.privacy} target="_blank" rel="noreferrer">
                {i18n.t('settingsPrivacyPolicy')}
                <Icon name="external-link" />
              </a>
              <a href={LINKS.permissions} target="_blank" rel="noreferrer">
                {i18n.t('settingsPermissions')}
                <Icon name="external-link" />
              </a>
            </div>
          </div>
        </section>

        <section id="whats-new" class={styles.section} aria-labelledby="al-whats-new-title">
          <div class={styles.sectionHead}>
            <h2 id="al-whats-new-title" class={styles.sectionTitle} tabIndex={-1}>
              <span class={styles.sectionIcon}>
                <Icon name="sparkles" />
              </span>
              <span class={styles.sectionLabel}>{i18n.t('settingsWhatsNew')}</span>
            </h2>
            <p class={styles.sectionNote}>{i18n.t('settingsVersion', [props.version])}</p>
          </div>
          <div class={styles.group}>
            <Toggle
              label={i18n.t('settingsWhatsNewInAloft')}
              checked={props.settings.whatsNewInAloft}
              onChange={(on) => set('whatsNewInAloft', on)}
              note={i18n.t('settingsWhatsNewInAloftNote')}
            />
            <div>
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
            </div>
          </div>
        </section>
      </main>
      <footer class={styles.footer}>
        <span>{i18n.t('settingsFooterVersion', [props.version])}</span>
        <a href={LINKS.source} target="_blank" rel="noreferrer">
          {i18n.t('settingsFooterSource')}
        </a>
        <span>
          {i18n.t('settingsFooterMadeBy')}{' '}
          <a href={LINKS.author} target="_blank" rel="noreferrer">
            {AUTHOR}
          </a>
        </span>
      </footer>
    </>
  )

  return (
    <div class={styles.layout}>
      {/* Hidden while a theme is being edited: leaving the editor drops the draft. */}
      <Show when={!editing()}>
        <nav ref={menu} class={styles.nav} aria-label={i18n.t('settingsSectionsLabel')}>
          <For each={SECTIONS}>
            {(section) => (
              <a
                class={styles.navItem}
                href={`#${section.id}`}
                aria-current={current() === section.id ? 'location' : undefined}
                onClick={(event) => {
                  event.preventDefault()
                  jumpTo(section.id)
                }}
              >
                <Icon name={section.icon} />
                <span class={styles.navLabel}>{section.label()}</span>
              </a>
            )}
          </For>
        </nav>
      </Show>
      <div ref={column} class={styles.column} onScroll={trackSection}>
        <div class={styles.content}>
          <Show when={editing()} fallback={list()}>
            {(current) => (
              <ThemeEditor
                theme={current().theme}
                saved={current().saved}
                error={themeError()}
                onChange={(theme) => setEditing({ ...current(), theme })}
                onSave={() => void saveEditing()}
                onCancel={closeEditor}
                dirty={JSON.stringify(current().theme) !== JSON.stringify(current().original)}
                onDelete={() => void deleteEditing()}
                onExport={() => props.onExportTheme(current().theme)}
              />
            )}
          </Show>
        </div>
      </div>
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
