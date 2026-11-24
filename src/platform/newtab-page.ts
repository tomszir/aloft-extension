import { browser } from 'wxt/browser'
import { NEW_TAB_STAYS, type NewTabStaysMessage } from './messages'

// Long enough for any real decision; past it, a background that hangs (on a
// frozen previous tab, say) shouldn't leave the new tab blank.
const GIVE_UP_MS = 1000

/** Resolves once the background has decided not to replace this new tab. */
export async function newTabStays(): Promise<void> {
  const message: NewTabStaysMessage = { type: NEW_TAB_STAYS }
  const asked = browser.runtime.sendMessage(message).catch(() => undefined)
  const gaveUp = new Promise((resolve) => setTimeout(resolve, GIVE_UP_MS))
  await Promise.race([asked, gaveUp])
}

const FOCUS_MARK = '?focus'

/**
 * The browser keeps keyboard focus in the address bar on its new tab page,
 * whatever the page focuses, so typing would never reach the palette. A page
 * that replaces itself gets focus, so this does that once. True when it did,
 * and the page is about to go away.
 */
export function takeFocusFromAddressBar(): boolean {
  if (location.search === FOCUS_MARK) return false
  location.replace(FOCUS_MARK)
  return true
}
