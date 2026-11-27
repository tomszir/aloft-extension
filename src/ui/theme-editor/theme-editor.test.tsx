import { fireEvent, render, screen } from '@solidjs/testing-library'
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

  it('changes the corner radius', () => {
    const props = renderEditor()
    fireEvent.input(screen.getByRole('slider'), { target: { value: '4' } })
    expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({ radius: 4 }))
  })

  it('warns when small text would be hard to read', () => {
    renderEditor({
      theme: { ...base, colors: { ...base.colors, muted: base.colors.panel } },
    })
    expect(screen.getAllByText('themeContrastIssue').length).toBeGreaterThan(0)
  })

  it('saves, cancels and exports; deletes only a saved theme', () => {
    const props = renderEditor()
    fireEvent.click(screen.getByRole('button', { name: 'themeSave' }))
    fireEvent.click(screen.getByRole('button', { name: 'themeCancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'themeExport' }))
    expect(props.onSave).toHaveBeenCalledOnce()
    expect(props.onCancel).toHaveBeenCalledOnce()
    expect(props.onExport).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'themeDelete' })).toBeNull()
  })

  it("can't be saved without a name", () => {
    renderEditor({ theme: { ...base, name: ' ' }, saved: true })
    expect((screen.getByRole('button', { name: 'themeSave' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
    expect(screen.getByRole('button', { name: 'themeDelete' })).toBeTruthy()
  })
})
