/** Aloft's shortcuts as the browser reports them; empty when one isn't set. */
export interface Shortcuts {
  /** "Open Aloft", Alt+Q unless changed. */
  main: string
  /** The second command, unset unless the person gave it a key, like Ctrl+T. */
  second: string
}

export const NO_SHORTCUTS: Shortcuts = { main: '', second: '' }

// Chromium writes Ctrl+T as "Ctrl+T", and Cmd+T on a Mac as "⌘T"; Firefox as
// "Ctrl+T" or "Command+T".
const NEW_TAB_KEY = /^(ctrl|⌘|command|cmd)\+?t$/i

/** Whether either shortcut is the one browsers use for a new tab. */
export function opensWithNewTabKey(shortcuts: Shortcuts): boolean {
  return [shortcuts.main, shortcuts.second].some((key) => NEW_TAB_KEY.test(key.replace(/\s/g, '')))
}
