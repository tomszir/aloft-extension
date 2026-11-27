import { fireEvent, render, screen, within } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'
import { PRESET_THEMES, type Theme } from '../../core/theme'
import { ThemeEditor, type ThemeEditorProps } from './theme-editor'

const base = PRESET_THEMES[0] as Theme

function renderEditor(overrides: Partial<ThemeEditorProps> = {}) {
  const props: ThemeEditorProps = {
    theme: { ...base, id: 'custom-mine', name: 'Mine' },
    saved: false,
    onChange: vi.fn(),
    onSave: vi.fn(),
    onCancel: vi.fn(),
    onDelete: vi.fn(),
    onExport: vi.fn(),
    ...overrides,
  }
  render(() => <ThemeEditor {...props} />)
  return props
}

// The test setup echoes i18n keys, so controls are found by their key.
describe('ThemeEditor', () => {
  it('says whether the theme is new or being edited', () => {
    renderEditor()
    expect(screen.getByRole('form', { name: 'themeNewTitle' })).toBeTruthy()
  })

  it('changes a color from its hex field, and ignores what is not a color', () => {
    const props = renderEditor()
    const field = screen.getByRole('textbox', { name: 'themeColorAccent' }) as HTMLInputElement
    fireEvent.change(field, { target: { value: 'ff8800' } })
    expect(props.onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ colors: expect.objectContaining({ accent: '#FF8800' }) }),
    )
    fireEvent.change(field, { target: { value: 'orange' } })
    expect(props.onChange).toHaveBeenCalledOnce()
    expect(field.value).toBe(base.colors.accent)
  })

  it('changes the corner radius by slider or preset', () => {
    const props = renderEditor()
    fireEvent.input(screen.getByRole('slider'), { target: { value: '4' } })
    expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({ radius: 4 }))
    fireEvent.click(screen.getByRole('button', { name: 'themeRadiusSquare' }))
    expect(props.onChange).toHaveBeenLastCalledWith(expect.objectContaining({ radius: 0 }))
  })

  it('shows how readable each text color is, and flags one that is too faint', () => {
    renderEditor()
    expect(screen.getAllByText('themeContrastOk')).toHaveLength(2)
    expect(screen.queryByText('themeContrastLow')).toBeNull()
    cleanupAndRender({ theme: { ...base, colors: { ...base.colors, muted: base.colors.panel } } })
    expect(screen.getByText('themeContrastLow')).toBeTruthy()
  })

  it('saves and goes back from the top bar; exports and deletes a saved theme at the end', () => {
    const props = renderEditor({ saved: true })
    expect(screen.getByRole('form', { name: 'themeEditTitle' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'themeSave' }))
    fireEvent.click(screen.getByRole('button', { name: 'themeBack' }))
    fireEvent.click(screen.getByRole('button', { name: 'themeExport' }))
    fireEvent.click(screen.getByRole('button', { name: 'themeDelete' }))
    // Deleting syncs to every device, so it asks first.
    expect(props.onDelete).not.toHaveBeenCalled()
    fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'themeDelete' }))
    expect(props.onSave).toHaveBeenCalledOnce()
    expect(props.onCancel).toHaveBeenCalledOnce()
    expect(props.onExport).toHaveBeenCalledOnce()
    expect(props.onDelete).toHaveBeenCalledOnce()
  })

  it('asks before going back with unsaved changes, and not without', () => {
    const props = renderEditor({ dirty: true })
    fireEvent.click(screen.getByRole('button', { name: 'themeBack' }))
    expect(props.onCancel).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'themeKeep' }))
    expect(screen.queryByRole('alert')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'themeBack' }))
    fireEvent.click(screen.getByRole('button', { name: 'themeDiscard' }))
    expect(props.onCancel).toHaveBeenCalledOnce()
  })

  it("has nothing to delete before it's saved, and can't be saved without a name", () => {
    renderEditor({ theme: { ...base, name: ' ' } })
    expect(screen.queryByRole('button', { name: 'themeDelete' })).toBeNull()
    expect((screen.getByRole('button', { name: 'themeSave' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
  })
})

function cleanupAndRender(overrides: Partial<ThemeEditorProps>) {
  document.body.innerHTML = ''
  renderEditor(overrides)
}
