import { fireEvent, render, screen, within } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { BUILT_IN_KEYWORDS, type Keyword } from '../../core/keywords'
import { KeywordSettings } from './keyword-settings'

// The test setup echoes i18n keys, so controls are found by their key.
function renderEditor(initial: readonly Keyword[] = BUILT_IN_KEYWORDS, fits = true) {
  const [keywords, setKeywords] = createSignal<readonly Keyword[]>(initial)
  const onChange = vi.fn(async (next: Keyword[]) => {
    if (fits) setKeywords(next)
    return fits
  })
  render(() => (
    <KeywordSettings
      keywords={keywords()}
      favicon={async () => null}
      onChange={onChange}
      newId={() => 'custom-new'}
    />
  ))
  return { keywords, onChange }
}

const rowOf = (name: string) => {
  const item = screen.getByText(name).closest('li')
  if (!(item instanceof HTMLElement)) throw new Error(`no row for ${name}`)
  return item
}

const fill = (form: HTMLElement, label: string, value: string) =>
  fireEvent.input(within(form).getByLabelText(label), { target: { value } })

describe('KeywordSettings', () => {
  it('lists every keyword with its keyword and a switch', () => {
    renderEditor()
    expect(screen.getAllByRole('switch')).toHaveLength(BUILT_IN_KEYWORDS.length)
    expect(within(rowOf('YouTube')).getByText('yt')).toBeTruthy()
  })

  it('switches a keyword off', async () => {
    const { keywords } = renderEditor()
    fireEvent.click(within(rowOf('Reddit')).getByRole('switch'))
    await vi.waitFor(() => expect(keywords().find((k) => k.id === 'reddit')?.enabled).toBe(false))
  })

  it('adds a keyword of the user’s own', async () => {
    const { keywords } = renderEditor()
    fireEvent.click(screen.getByRole('button', { name: 'keywordAdd' }))
    const form = screen.getByRole('form')
    fill(form, 'keywordName', 'My wiki')
    fill(form, 'keywordKeyword', 'mw')
    fill(form, 'keywordAddress', 'https://wiki.test/?q=%s')
    fireEvent.submit(form)
    await vi.waitFor(() =>
      expect(keywords().at(-1)).toMatchObject({ id: 'custom-new', keyword: 'mw', builtIn: false }),
    )
    await vi.waitFor(() => expect(screen.queryByRole('form')).toBeNull())
  })

  it('says why a draft can’t be saved, and saves nothing', () => {
    const { onChange } = renderEditor()
    fireEvent.click(within(rowOf('GitHub')).getByRole('button', { name: 'keywordEdit' }))
    const form = screen.getByRole('form')
    fill(form, 'keywordKeyword', 'yt')
    fireEvent.submit(form)
    expect(screen.getByRole('alert').textContent).toBe('keywordErrorTaken')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('built-ins can be edited but not deleted; the user’s own can be deleted', async () => {
    const mine: Keyword = {
      id: 'custom-1',
      name: 'Mine',
      keyword: 'mine',
      url: 'https://m.test/?q=%s',
      kind: 'search',
      enabled: true,
      builtIn: false,
    }
    const { keywords } = renderEditor([...BUILT_IN_KEYWORDS, mine])
    fireEvent.click(within(rowOf('GitHub')).getByRole('button', { name: 'keywordEdit' }))
    expect(screen.queryByRole('button', { name: 'keywordDelete' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'keywordCancel' }))

    fireEvent.click(within(rowOf('Mine')).getByRole('button', { name: 'keywordEdit' }))
    fireEvent.click(screen.getByRole('button', { name: 'keywordDelete' }))
    await vi.waitFor(() => expect(keywords().some((k) => k.id === 'custom-1')).toBe(false))
  })

  it('reset asks first, and is off while nothing has changed', async () => {
    const changed = BUILT_IN_KEYWORDS.map((k) => (k.id === 'github' ? { ...k, keyword: 'hub' } : k))
    const { keywords } = renderEditor(changed)
    fireEvent.click(screen.getByRole('button', { name: 'keywordReset' }))
    expect(keywords()).toEqual(changed)
    fireEvent.click(screen.getByRole('button', { name: 'keywordResetYes' }))
    await vi.waitFor(() => expect(keywords()).toEqual(BUILT_IN_KEYWORDS))
    expect(screen.getByRole('button', { name: 'keywordReset' }).hasAttribute('disabled')).toBe(true)
  })

  it('keeps the form open and says so when the list is too big to sync', async () => {
    renderEditor(BUILT_IN_KEYWORDS, false)
    fireEvent.click(screen.getByRole('button', { name: 'keywordAdd' }))
    const form = screen.getByRole('form')
    fill(form, 'keywordName', 'Big')
    fill(form, 'keywordKeyword', 'big')
    fill(form, 'keywordAddress', 'https://big.test/?q=%s')
    fireEvent.submit(form)
    expect((await screen.findByRole('alert')).textContent).toBe('keywordErrorFull')
    expect(screen.getByRole('form')).toBeTruthy()
  })
})
