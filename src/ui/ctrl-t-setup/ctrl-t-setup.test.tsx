import { fireEvent, render, screen } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'
import { CtrlTSetup } from './ctrl-t-setup'

// The test setup echoes i18n keys, so text is found by its key.
describe('CtrlTSetup', () => {
  it("walks through setting Ctrl+T on the browser's shortcuts page", () => {
    const onSetUp = vi.fn()
    render(() => <CtrlTSetup shortcuts={{ main: 'Alt+Q', second: '' }} onSetUp={onSetUp} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'ctrlTButton' }))
    expect(onSetUp).toHaveBeenCalledOnce()
    expect(screen.queryByText('ctrlTDone')).toBeNull()
  })

  it('says so once Ctrl+T opens Aloft, whichever shortcut has it', () => {
    render(() => <CtrlTSetup shortcuts={{ main: 'Alt+Q', second: 'Ctrl+T' }} onSetUp={vi.fn()} />)
    expect(screen.getByText('ctrlTDone')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
