import { browser } from 'wxt/browser'

/** Empty when the user cleared the shortcut or another extension took it. */
export async function openShortcut(): Promise<string> {
  const all = await browser.commands.getAll()
  return all.find((c) => c.name === 'open-aloft')?.shortcut ?? ''
}

export function openShortcutSettings(): void {
  void browser.tabs.create({ url: 'chrome://extensions/shortcuts' })
}
