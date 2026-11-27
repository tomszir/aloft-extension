import { browser } from 'wxt/browser'
import { RELEASES } from '../core/releases'
import { watchNewTabs } from '../platform/newtab-intercept'
import { openAloft } from '../platform/overlay'
import { serveRelay } from '../platform/relay-host'
import { currentVersion, noteUpdate } from '../platform/whats-new'

export default defineBackground(() => {
  browser.commands.onCommand.addListener((command, tab) => {
    if (command === 'open-aloft') void openAloft(tab)
  })

  watchNewTabs()
  if (import.meta.env.FIREFOX) serveRelay()

  // Ctrl+T needs site access, and that can only be asked for from a click, so
  // a first-run page explains it rather than Ctrl+T silently not working.
  browser.runtime.onInstalled.addListener(({ reason, previousVersion }) => {
    if (reason === 'install')
      void browser.tabs.create({ url: browser.runtime.getURL('/onboarding.html') })
    // Nothing opens on an update; Aloft mentions it quietly instead (see
    // platform/whats-new.ts).
    if (reason === 'update' && previousVersion)
      void noteUpdate(previousVersion, currentVersion(), RELEASES, Date.now())
  })

  // Tests can't press browser shortcuts, so the e2e build exposes the same
  // entry point the shortcut uses. Dropped from production builds.
  if (import.meta.env.MODE === 'e2e') Reflect.set(globalThis, 'aloftTest', { openAloft })
})
