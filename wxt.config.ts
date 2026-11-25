import { defineConfig } from 'wxt'

// Each permission is listed with the reason the Web Store review form asks for.
// Keep docs/permissions.md in sync when this list changes.
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-solid', '@wxt-dev/i18n/module'],
  // WXT builds Firefox as MV2 unless told otherwise.
  manifestVersion: 3,
  // CSS stays kebab-case; components read the classes as camelCase.
  vite: () => ({
    css: { modules: { localsConvention: 'camelCaseOnly' } },
  }),
  manifest: ({ mode, browser }) => ({
    name: '__MSG_extName__',
    short_name: '__MSG_extShortName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              // Permanent once the add-on is on addons.mozilla.org.
              id: 'aloft@tomszir',
              // The ESR at the time Firefox support started.
              strict_min_version: '140.0',
              // addons.mozilla.org requires the declaration; Aloft collects nothing.
              data_collection_permissions: { required: ['none'] },
            },
          },
        }
      : {
          // 121 adds tabs.Tab.lastAccessed, which Ctrl+T uses to find the tab
          // to return to.
          minimum_chrome_version: '121',
        }),
    permissions: [
      'storage', // settings and themes
      'tabs', // tab titles and URLs for "switch to tab" results and pinned tabs
      'history', // history results
      'bookmarks', // bookmark results
      'sessions', // "recently closed" results
      'search', // send a query to the user's default search engine
      'scripting', // draw the palette frame on the current page
      'activeTab', // lets the keyboard shortcut work without site access
      // favicons via chrome-extension://<id>/_favicon/; Firefox has no such cache
      ...(browser === 'firefox' ? [] : ['favicon']),
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
    web_accessible_resources: [
      {
        resources: ['palette.html'],
        matches: ['<all_urls>'],
        // A dynamic URL stops pages from detecting Aloft by probing a fixed
        // chrome-extension:// address. Firefox's moz-extension:// addresses
        // are already random per install.
        ...(browser === 'firefox' ? {} : { use_dynamic_url: true }),
      },
    ],
  }),
})
