import { For, Show } from 'solid-js'
import { i18n } from '#i18n'
import { contrastRatio, MIN_TEXT_CONTRAST, type Theme, type ThemeColors } from '../../core/theme'
import { Button } from '../button/button'
import '../icon/page-icons'
import { SettingRow } from '../setting-row/setting-row'
import styles from './theme-editor.module.css'

export interface ThemeEditorProps {
  /** The theme as edited so far; the preview shows it before it's saved. */
  theme: Theme
  /** False for a theme not saved yet, which has nothing to delete. */
  saved: boolean
  /** Why saving failed, if it did. */
  error?: string | undefined
  onChange: (theme: Theme) => void
  onSave: () => void
  onCancel: () => void
  onDelete: () => void
  onExport: () => void
}

type ColorKey = keyof ThemeColors

interface ColorField {
  key: ColorKey
  label: () => string
  description: () => string
  /** Text colors show how readable they are on the backgrounds they sit on. */
  readableOn?: readonly ColorKey[]
}

// Grouped by what they color, as theme builders do, rather than one long list.
const GROUPS: readonly { title: () => string; fields: readonly ColorField[] }[] = [
  {
    title: () => i18n.t('themeGroupSurfaces'),
    fields: [
      {
        key: 'panel',
        label: () => i18n.t('themeColorPanel'),
        description: () => i18n.t('themeColorPanelNote'),
      },
      {
        key: 'selected',
        label: () => i18n.t('themeColorSelected'),
        description: () => i18n.t('themeColorSelectedNote'),
      },
      {
        key: 'border',
        label: () => i18n.t('themeColorBorder'),
        description: () => i18n.t('themeColorBorderNote'),
      },
    ],
  },
  {
    title: () => i18n.t('themeGroupText'),
    fields: [
      {
        key: 'text',
        label: () => i18n.t('themeColorText'),
        description: () => i18n.t('themeColorTextNote'),
        readableOn: ['panel', 'selected'],
      },
      {
        key: 'muted',
        label: () => i18n.t('themeColorMuted'),
        description: () => i18n.t('themeColorMutedNote'),
        readableOn: ['panel', 'selected'],
      },
    ],
  },
  {
    title: () => i18n.t('themeGroupAccent'),
    fields: [
      {
        key: 'accent',
        label: () => i18n.t('themeColorAccent'),
        description: () => i18n.t('themeColorAccentNote'),
      },
    ],
  },
]

const RADIUS_PRESETS: readonly { radius: number; label: () => string }[] = [
  { radius: 0, label: () => i18n.t('themeRadiusSquare') },
  { radius: 8, label: () => i18n.t('themeRadiusSoft') },
  { radius: 14, label: () => i18n.t('themeRadiusRound') },
  { radius: 22, label: () => i18n.t('themeRadiusRounder') },
]

const HEX = /^#[0-9a-f]{6}$/i
const MAX_RADIUS = 24

/** A focused view for one theme: six colors and a corner radius, everything else derived. */
export function ThemeEditor(props: ThemeEditorProps) {
  const setColor = (key: ColorKey, value: string) => {
    if (!HEX.test(value)) return
    props.onChange({
      ...props.theme,
      colors: { ...props.theme.colors, [key]: value.toUpperCase() },
    })
  }
  // The weaker of the backgrounds it sits on is what decides.
  const contrast = (field: ColorField) =>
    Math.min(
      ...(field.readableOn ?? []).map((bg) =>
        contrastRatio(props.theme.colors[field.key], props.theme.colors[bg]),
      ),
    )

  return (
    <form
      class={styles.editor}
      aria-labelledby="al-theme-editor-title"
      onSubmit={(event) => {
        event.preventDefault()
        props.onSave()
      }}
    >
      <header class={styles.bar}>
        <Button icon="arrow-left" onClick={() => props.onCancel()}>
          {i18n.t('themeBack')}
        </Button>
        <h2 id="al-theme-editor-title" class={styles.title}>
          {props.saved ? i18n.t('themeEditTitle') : i18n.t('themeNewTitle')}
        </h2>
        <Button
          type="submit"
          variant="primary"
          icon="check"
          disabled={props.theme.name.trim() === ''}
        >
          {i18n.t('themeSave')}
        </Button>
      </header>

      <Show when={props.error}>
        {(error) => (
          <p class={styles.error} role="alert">
            {error()}
          </p>
        )}
      </Show>

      <section class={styles.group}>
        <SettingRow
          label={i18n.t('themeName')}
          labelId="al-theme-name"
          description={
            props.theme.scheme === 'dark' ? i18n.t('themeForDark') : i18n.t('themeForLight')
          }
        >
          <input
            class={styles.input}
            value={props.theme.name}
            maxLength={40}
            required
            aria-labelledby="al-theme-name"
            onInput={(event) => props.onChange({ ...props.theme, name: event.currentTarget.value })}
          />
        </SettingRow>
      </section>

      <For each={GROUPS}>
        {(group) => (
          <section class={styles.section}>
            <h3 class={styles.heading}>{group.title()}</h3>
            <div class={styles.group}>
              <For each={group.fields}>
                {(field) => (
                  <SettingRow label={field.label()} description={field.description()}>
                    <Show when={field.readableOn}>
                      <span
                        class={styles.badge}
                        data-low={contrast(field) < MIN_TEXT_CONTRAST || undefined}
                        title={i18n.t('themeContrastHint')}
                      >
                        {contrast(field) < MIN_TEXT_CONTRAST
                          ? i18n.t('themeContrastLow', [contrast(field).toFixed(1)])
                          : i18n.t('themeContrastOk', [contrast(field).toFixed(1)])}
                      </span>
                    </Show>
                    <input
                      class={styles.swatch}
                      type="color"
                      value={props.theme.colors[field.key].toLowerCase()}
                      aria-label={i18n.t('themeColorPick', [field.label()])}
                      onInput={(event) => setColor(field.key, event.currentTarget.value)}
                    />
                    <input
                      class={`${styles.input} ${styles.hex}`}
                      value={props.theme.colors[field.key]}
                      maxLength={7}
                      spellcheck={false}
                      autocapitalize="off"
                      aria-label={field.label()}
                      onChange={(event) => {
                        const value = event.currentTarget.value.trim()
                        const hex = value.startsWith('#') ? value : `#${value}`
                        if (HEX.test(hex)) setColor(field.key, hex)
                        else event.currentTarget.value = props.theme.colors[field.key]
                      }}
                    />
                  </SettingRow>
                )}
              </For>
            </div>
          </section>
        )}
      </For>

      <section class={styles.section}>
        <h3 class={styles.heading}>{i18n.t('themeGroupCorners')}</h3>
        <div class={styles.group}>
          <SettingRow
            label={i18n.t('themeRadius')}
            labelId="al-theme-radius"
            description={i18n.t('themeRadiusValue', [String(props.theme.radius)])}
            stacked
          >
            <input
              class={styles.range}
              type="range"
              min={0}
              max={MAX_RADIUS}
              step={1}
              value={props.theme.radius}
              aria-labelledby="al-theme-radius"
              onInput={(event) =>
                props.onChange({ ...props.theme, radius: Number(event.currentTarget.value) })
              }
            />
            <div class={styles.presets}>
              <For each={RADIUS_PRESETS}>
                {(preset) => (
                  <button
                    type="button"
                    class={styles.preset}
                    aria-pressed={props.theme.radius === preset.radius}
                    onClick={() => props.onChange({ ...props.theme, radius: preset.radius })}
                  >
                    <span
                      class={styles.corner}
                      style={{ 'border-top-left-radius': `${preset.radius}px` }}
                      aria-hidden="true"
                    />
                    {preset.label()}
                  </button>
                )}
              </For>
            </div>
          </SettingRow>
        </div>
      </section>

      <footer class={styles.footer}>
        <Button icon="download" onClick={() => props.onExport()}>
          {i18n.t('themeExport')}
        </Button>
        <Show when={props.saved}>
          <Button class={styles.danger} icon="trash-2" onClick={() => props.onDelete()}>
            {i18n.t('themeDelete')}
          </Button>
        </Show>
      </footer>
    </form>
  )
}
