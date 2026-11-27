import { browser } from 'wxt/browser'
import type { Shortcuts } from '../core/shortcut'

/** Each is empty when unset, or when another extension took the key. */
export async function openShortcuts(): Promise<Shortcuts> {
  const all = await browser.commands.getAll()
  const key = (name: string) => all.find((c) => c.name === name)?.shortcut ?? ''
  return { main: key('open-aloft'), second: key('open-aloft-second') }
}

// Firefox doesn't let extensions open its add-ons pages, and has this call
// instead (Firefox 137+). Chromium has neither the call nor its type, so it
// gets its shortcuts page.
export function openShortcutSettings(): void {
  const open: unknown = Reflect.get(browser.commands, 'openShortcutSettings')
  if (typeof open === 'function') {
    void Reflect.apply(open, browser.commands, [])
    return
  }
  void browser.tabs.create({ url: 'chrome://extensions/shortcuts' })
}
