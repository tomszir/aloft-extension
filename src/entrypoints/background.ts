import { browser } from 'wxt/browser'
import { watchNewTabs } from '../platform/newtab-intercept'
import { openAloft } from '../platform/overlay'

export default defineBackground(() => {
  browser.commands.onCommand.addListener((command, tab) => {
    if (command === 'open-aloft') void openAloft(tab)
  })

  watchNewTabs()

  // Ctrl+T needs site access, and that can only be asked for from a click, so
  // a first-run page explains it rather than Ctrl+T silently not working.
  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install')
      void browser.tabs.create({ url: browser.runtime.getURL('/onboarding.html') })
  })

  // Tests can't press browser shortcuts, so the e2e build exposes the same
  // entry point the shortcut uses. Dropped from production builds.
  if (import.meta.env.MODE === 'e2e') Reflect.set(globalThis, 'aloftTest', { openAloft })
})
