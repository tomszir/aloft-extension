import { describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { parseChangelog } from '../core/changelog'
import { dismissWhatsNew, loadWhatsNew, noteUpdate } from './whats-new'

const releases = parseChangelog(`## 0.6.1 — 3 December 2026

- Small fixes and improvements.

## 0.6.0 — 1 December 2026

- Something you'll notice.

## 0.5.0 — 25 November 2026

- A new name.
`)
const DAY = 24 * 60 * 60 * 1000

describe('whats-new', () => {
  it('remembers an update worth mentioning, for two weeks', async () => {
    await noteUpdate('0.5.0', '0.6.0', releases, 0)
    expect(await loadWhatsNew(DAY)).toEqual({ from: '0.5.0', until: 14 * DAY })
    expect(await loadWhatsNew(14 * DAY)).toBeUndefined()
  })

  it('stays quiet about an update with only small fixes', async () => {
    await noteUpdate('0.6.0', '0.6.1', releases, 0)
    expect(await loadWhatsNew(0)).toBeUndefined()
  })

  it('adds up updates nobody looked at yet, and starts over once looked at', async () => {
    await noteUpdate('0.5.0', '0.6.0', releases, 0)
    await noteUpdate('0.6.0', '0.6.1', releases, DAY)
    expect(await loadWhatsNew(DAY)).toEqual({ from: '0.5.0', until: 15 * DAY })

    await dismissWhatsNew()
    expect(await loadWhatsNew(DAY)).toBeUndefined()
    await noteUpdate('0.6.0', '0.6.1', releases, DAY)
    expect(await loadWhatsNew(DAY)).toBeUndefined()
  })

  it('ignores a stored value it does not understand', async () => {
    await fakeBrowser.storage.local.set({ whatsNew: { from: 5 } })
    expect(await loadWhatsNew(0)).toBeUndefined()
  })
})
