import { defineConfig } from 'wxt'

// Each permission is listed with the reason the Web Store review form asks for.
// Keep docs/permissions.md in sync when this list changes.
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-solid', '@wxt-dev/i18n/module'],
  // CSS stays kebab-case; components read the classes as camelCase.
  vite: () => ({
    css: { modules: { localsConvention: 'camelCaseOnly' } },
  }),
  manifest: ({ mode }) => ({
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    // 121 adds tabs.Tab.lastAccessed, which Ctrl+T uses to find the tab to
    // return to.
    minimum_chrome_version: '121',
    permissions: [
      'storage', // settings and themes
      'tabs', // tab titles and URLs for "switch to tab" results and pinned tabs
      'history', // history results
      'bookmarks', // bookmark results
      'sessions', // "recently closed" results
      'search', // send a query to the user's default search engine
      'scripting', // draw the palette frame on the current page
      'activeTab', // lets the keyboard shortcut work without site access
      'favicon', // favicons via chrome-extension://<id>/_favicon/
    ],
    // Asked for only when the user turns on Ctrl+T or Ctrl+L: those aren't a
    // gesture Chrome grants activeTab for, so Aloft needs site access to draw
    // over the page.
    optional_host_permissions: ['<all_urls>'],
    // Automated tests can't press the shortcut that grants activeTab, so only
    // the e2e build starts with site access.
    host_permissions: mode === 'e2e' ? ['<all_urls>'] : undefined,
    commands: {
      'open-aloft': {
        suggested_key: { default: 'Alt+Q' },
        description: '__MSG_commandOpen__',
      },
    },
    // A dynamic URL stops pages from detecting Aloft by probing a fixed
    // chrome-extension:// address.
    web_accessible_resources: [
      {
        resources: ['palette.html'],
        matches: ['<all_urls>'],
        use_dynamic_url: true,
      },
    ],
  }),
})
