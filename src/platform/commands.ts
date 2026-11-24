import { browser } from 'wxt/browser'

/** Empty when the user cleared the shortcut or another extension took it. */
export async function openShortcut(): Promise<string> {
  const all = await browser.commands.getAll()
  return all.find((c) => c.name === 'open-aloft')?.shortcut ?? ''
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
