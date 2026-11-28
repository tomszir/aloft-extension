import { fireEvent, render, screen, within } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { exportBackup, MAX_BACKUP_BYTES } from '../../core/backup'
import { BUILT_IN_KEYWORDS, type Keyword } from '../../core/keywords'
import { DEFAULT_SETTINGS, type Settings } from '../../core/settings'
import type { Theme, ThemesSaved } from '../../core/theme'
import { BackupSettings } from './backup-settings'

const ember: Theme = {
  id: 'custom-ember',
  name: 'Ember',
  scheme: 'dark',
  radius: 6,
  colors: {
    panel: '#1A1110',
    selected: '#2A1C1A',
    border: '#3A2522',
    text: '#F5E6E2',
    muted: '#C2A8A2',
    accent: '#FF7A45',
  },
}

const docs: Keyword = {
  id: 'custom-docs',
  name: 'Docs',
  keyword: 'docs',
  url: 'https://docs.example/?q=%s',
  kind: 'search',
  enabled: true,
  builtIn: false,
}

const backupSettings: Settings = {
  ...DEFAULT_SETTINGS,
  enterOpensIn: 'current-tab',
  appearance: { ...DEFAULT_SETTINGS.appearance, colorScheme: 'dark', darkTheme: ember.id },
}

const backupText = () =>
  exportBackup({
    settings: backupSettings,
    themes: [ember],
    keywords: [...BUILT_IN_KEYWORDS, docs],
  })

function renderBackup(saveThemes: ThemesSaved = 'saved') {
  const [settings, setSettings] = createSignal<Settings>(DEFAULT_SETTINGS)
  const [themes, setThemes] = createSignal<readonly Theme[]>([])
  const [keywords, setKeywords] = createSignal<readonly Keyword[]>(BUILT_IN_KEYWORDS)
  const calls: string[] = []
  const onExport = vi.fn()
  const onChange = vi.fn((change: (current: Settings) => Settings) => {
    calls.push('settings')
    setSettings(change(settings()))
  })
  const onSaveThemes = vi.fn(async (next: readonly Theme[]) => {
    calls.push('themes')
    if (saveThemes === 'saved') setThemes(next)
    return saveThemes
  })
  const onKeywordsChange = vi.fn(async (next: Keyword[]) => {
    calls.push('keywords')
    setKeywords(next)
    return true
  })
  render(() => (
    <BackupSettings
      settings={settings()}
      customThemes={themes()}
      keywords={keywords()}
      onExport={onExport}
      onChange={onChange}
      onSaveThemes={onSaveThemes}
      onKeywordsChange={onKeywordsChange}
    />
  ))
  return { settings, themes, keywords, calls, onExport, onChange, onSaveThemes, onKeywordsChange }
}

const input = () => screen.getByLabelText('backupImport') as HTMLInputElement
const choose = (text: string) =>
  fireEvent.change(input(), {
    target: { files: [new File([text], 'backup.json', { type: 'application/json' })] },
  })

// The test setup echoes i18n keys, so controls are found by their key.
describe('BackupSettings', () => {
  it('exports the settings, themes and keywords in use', () => {
    const { onExport } = renderBackup()
    fireEvent.click(screen.getByRole('button', { name: 'backupExportButton' }))
    const text = onExport.mock.calls[0]?.[0]
    expect(JSON.parse(text)).toMatchObject({
      format: 'aloft-backup',
      settings: DEFAULT_SETTINGS,
      themes: [],
      keywords: { builtIn: {}, custom: [] },
    })
  })

  it('opens the file picker from the import button', () => {
    renderBackup()
    const click = vi.spyOn(input(), 'click')
    fireEvent.click(screen.getByRole('button', { name: 'backupImportButton' }))
    expect(click).toHaveBeenCalledOnce()
  })

  it('shows what will change and saves nothing until confirmed', async () => {
    const { onChange, onSaveThemes, onKeywordsChange } = renderBackup()
    choose(backupText())
    const ask = await screen.findByRole('alert')
    expect(within(ask).getByText('backupAsk')).toBeTruthy()
    const lines = within(ask)
      .getAllByRole('listitem')
      .map((li) => li.textContent)
    expect(lines).toEqual(['backupReplacesSettings', 'backupThemesAdded', 'backupKeywordsAdded'])
    expect(onChange).not.toHaveBeenCalled()
    expect(onSaveThemes).not.toHaveBeenCalled()
    expect(onKeywordsChange).not.toHaveBeenCalled()

    fireEvent.click(within(ask).getByRole('button', { name: 'backupCancel' }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('restores themes, then keywords, then the settings that use them', async () => {
    const { settings, themes, keywords, calls } = renderBackup()
    choose(backupText())
    fireEvent.click(
      within(await screen.findByRole('alert')).getByRole('button', { name: 'backupRestore' }),
    )
    await vi.waitFor(() => expect(calls).toEqual(['themes', 'keywords', 'settings']))
    expect(themes()).toEqual([ember])
    expect(keywords().at(-1)).toEqual(docs)
    expect(settings()).toEqual(backupSettings)
    expect(await screen.findByText('backupRestored')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('stops before the settings when the themes aren’t saved', async () => {
    const { onChange, onKeywordsChange } = renderBackup('failed')
    choose(backupText())
    fireEvent.click(
      within(await screen.findByRole('alert')).getByRole('button', { name: 'backupRestore' }),
    )
    await vi.waitFor(() => expect(screen.getByRole('alert').textContent).toBe('backupFailed'))
    expect(onKeywordsChange).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('says when a backup matches what is in use, offering nothing to restore', async () => {
    renderBackup()
    choose(exportBackup({ settings: DEFAULT_SETTINGS, themes: [], keywords: BUILT_IN_KEYWORDS }))
    const ask = await screen.findByRole('alert')
    expect(within(ask).getByText('backupNothing')).toBeTruthy()
    expect(within(ask).queryByRole('button', { name: 'backupRestore' })).toBeNull()
    fireEvent.click(within(ask).getByRole('button', { name: 'backupClose' }))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('warns that a backup from a newer Aloft may not all carry over', async () => {
    renderBackup()
    const newer = { ...JSON.parse(backupText()), version: 99 }
    choose(JSON.stringify(newer))
    expect(within(await screen.findByRole('alert')).getByText('backupNewer')).toBeTruthy()
  })

  it.each([
    ['not JSON', 'not json', 'backupNotBackup'],
    ['a theme file', '{"format":"aloft-theme","version":1}', 'backupNotBackup'],
    ['too big', `"${'x'.repeat(MAX_BACKUP_BYTES)}"`, 'backupTooLarge'],
  ])('explains a file that is %s', async (_, text, message) => {
    const { onChange } = renderBackup()
    choose(text)
    await vi.waitFor(() => expect(screen.getByRole('alert').textContent).toBe(message))
    expect(onChange).not.toHaveBeenCalled()
  })
})
