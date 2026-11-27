import { browser } from 'wxt/browser'
import { compareVersions } from '../core/changelog'
import { hadNewTabReplacement } from './settings'

/** The release that stopped replacing the new tab page. */
const CTRL_T_MOVED_IN = '1.0.0'

/**
 * Before 1.0, Ctrl+T opened Aloft by replacing the new tab page. That's gone:
 * Ctrl+T now opens Aloft only once someone gives it to Aloft. People who used
 * it would otherwise just get a blank tab with no idea why, so the one time
 * they update past it, the onboarding page opens where it shows how.
 */
export async function tellCtrlTUsers(previousVersion: string): Promise<void> {
  if (compareVersions(previousVersion, CTRL_T_MOVED_IN) >= 0) return
  if (!(await hadNewTabReplacement())) return
  await browser.tabs.create({ url: browser.runtime.getURL('/onboarding.html#ctrl-t') })
}
