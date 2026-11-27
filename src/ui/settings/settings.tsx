import { createSignal, Show } from 'solid-js'
import { i18n } from '#i18n'
import { type Release, releasesBetween } from '../../core/changelog'
import type { Keyword } from '../../core/keywords'
import type { Settings as SettingsValue } from '../../core/settings'
import type { Shortcuts } from '../../core/shortcut'
import { PRESET_THEMES } from '../../core/theme'
import { Button } from '../button/button'
import { Choice } from '../choice/choice'
import { CtrlTSetup } from '../ctrl-t-setup/ctrl-t-setup'
import type { FaviconLoader } from '../favicon/favicon'
import { KeywordSettings } from '../keyword-settings/keyword-settings'
import { Logo } from '../logo/logo'
import { ReleaseNotes } from '../release-notes/release-notes'
import { SettingsPreview } from '../settings-preview/settings-preview'
import { ShortcutSentence } from '../shortcut-sentence/shortcut-sentence'
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
}

type Sources = SettingsValue['sources']
type Appearance = SettingsValue['appearance']

const SOURCES: readonly { key: keyof Sources; label: () => string }[] = [
  { key: 'tabs', label: () => i18n.t('sectionOpenTabs') },
  { key: 'history', label: () => i18n.t('sectionHistory') },
  { key: 'bookmarks', label: () => i18n.t('sectionBookmarks') },
  { key: 'recentlyClosed', label: () => i18n.t('sectionRecentlyClosed') },
]

const themesFor = (scheme: 'light' | 'dark') => PRESET_THEMES.filter((t) => t.scheme === scheme)

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
              value={props.settings.appearance.lightTheme}
              onChange={(id) => setAppearance('lightTheme', id)}
            />
          </Show>
          <Show when={scheme() !== 'light'}>
            <ThemePicker
              label={i18n.t('settingsDarkTheme')}
              themes={themesFor('dark')}
              value={props.settings.appearance.darkTheme}
              onChange={(id) => setAppearance('darkTheme', id)}
            />
          </Show>
          <Choice
            label={i18n.t('settingsPosition')}
            options={[
              { value: 'upper-third', label: i18n.t('settingsPositionUpperThird') },
              { value: 'center', label: i18n.t('settingsPositionCenter') },
            ]}
            value={props.settings.appearance.position}
            onChange={(value) => setAppearance('position', value)}
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
        <SettingsPreview src={props.previewSrc} appearance={props.settings.appearance} />
      </aside>
    </div>
  )
}
