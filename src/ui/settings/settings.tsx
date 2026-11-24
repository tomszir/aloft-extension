import { createSignal, Show } from 'solid-js'
import { i18n } from '#i18n'
import type { Keyword } from '../../core/keywords'
import type { Settings as SettingsValue } from '../../core/settings'
import { PRESET_THEMES } from '../../core/theme'
import { Button } from '../button/button'
import { Choice } from '../choice/choice'
import type { FaviconLoader } from '../favicon/favicon'
import { KeywordSettings } from '../keyword-settings/keyword-settings'
import { Logo } from '../logo/logo'
import type { AccessState } from '../onboarding/onboarding'
import { ShortcutSentence } from '../shortcut-sentence/shortcut-sentence'
import { ThemePicker } from '../theme-picker/theme-picker'
import { Toggle } from '../toggle/toggle'
import styles from './settings.module.css'

export interface SettingsProps {
  settings: SettingsValue
  onChange: (change: (current: SettingsValue) => SettingsValue) => void
  /** Empty when the user cleared the shortcut or another extension took it. */
  shortcut: string
  onChangeShortcut: () => void
  access: AccessState
  onAllow: () => void
  /** The palette itself, in preview mode, so it shows exactly what Aloft will. */
  previewSrc: string
  keywords: readonly Keyword[]
  onKeywordsChange: (keywords: Keyword[]) => Promise<boolean>
  favicon: FaviconLoader
  /** Clears every learned pick on this device. */
  onForgetPicks: () => Promise<void>
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

  return (
    <main class={styles.page}>
      <header class={styles.header}>
        <Logo label={i18n.t('extName')} />
        <h1 class={styles.title}>{i18n.t('settingsTitle')}</h1>
      </header>

      <section class={styles.preview} aria-labelledby="al-preview-title">
        <h2 id="al-preview-title" class={styles.heading}>
          {i18n.t('settingsPreview')}
        </h2>
        <p class={styles.note}>{i18n.t('settingsPreviewNote')}</p>
        <iframe class={styles.frame} src={props.previewSrc} title={i18n.t('settingsPreview')} />
      </section>

      <section class={styles.card} aria-labelledby="al-opening-title">
        <h2 id="al-opening-title" class={styles.heading}>
          {i18n.t('settingsOpening')}
        </h2>
        <div class={styles.shortcut}>
          <ShortcutSentence shortcut={props.shortcut} class={styles.text} />
          <Button onClick={() => props.onChangeShortcut()}>
            {i18n.t('onboardingChangeShortcut')}
          </Button>
        </div>
        <Toggle
          label={i18n.t('settingsCtrlT')}
          checked={props.settings.replaceNewTab}
          onChange={(on) => set('replaceNewTab', on)}
          note={
            <Show
              when={props.settings.replaceNewTab && props.access !== 'granted'}
              fallback={i18n.t('settingsCtrlTNote')}
            >
              <div class={styles.noteBody} aria-live="polite">
                <span>
                  {props.access === 'denied'
                    ? i18n.t('onboardingDenied')
                    : i18n.t('settingsCtrlTNeedsAccess')}
                </span>
                <Show when={props.access !== 'unknown'}>
                  <div>
                    <Button variant="primary" onClick={() => props.onAllow()}>
                      {i18n.t('onboardingAllow')}
                    </Button>
                  </div>
                </Show>
              </div>
            </Show>
          }
        />
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
                <Button onClick={() => void forgetPicks()}>{i18n.t('settingsForgetPicks')}</Button>
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
    </main>
  )
}
