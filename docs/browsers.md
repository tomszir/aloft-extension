# Browser support

Every feature has to work in every Tier 1 browser, or leave out a part on purpose, recorded here and covered by a test. How the code handles the differences: [architecture.md](architecture.md#browser-support).

## Tiers

| Tier                 | Browsers                                                     | Package                                                 | Tested                                                            |
| -------------------- | ------------------------------------------------------------ | ------------------------------------------------------- | ----------------------------------------------------------------- |
| **1: Chromium**      | Chrome, Helium, Brave, Edge, Vivaldi, Opera, Arc, Dia        | the Chrome zip (Chrome Web Store; Edge Add-ons planned) | e2e in Chromium and Helium; the others by hand before a release   |
| **1: Firefox**       | Firefox 140 (the current ESR) and newer                      | the Firefox zip (addons.mozilla.org, planned)           | e2e with Puppeteer (`tests/e2e-firefox`)                          |
| **2: Firefox forks** | Zen, LibreWolf, Floorp, Waterfox                             | the Firefox zip                                         | best-effort: bugs are fixed when they don't hurt a Tier 1 browser |
| **Not supported**    | Safari, Orion, mobile browsers, Tor Browser, Mullvad Browser | none                                                    | none                                                              |

Why some browsers aren't supported:

- **Safari and Orion** (WebKit) have no `history`, `bookmarks`, `search` or favicon APIs, which is most of what Aloft searches.
- **Mobile browsers** have no keyboard shortcuts (`commands`), which is how Aloft opens.
- **Tor Browser and Mullvad Browser** ask users not to install extensions, because each one makes them easier to fingerprint.

## What works where

"Unchecked" means not tried yet. Replace it with the result once someone has checked.

Ctrl+T opens Aloft only once someone gives it to Aloft's second shortcut on the browser's shortcuts page; extensions can't suggest it themselves.

| Browser          | Alt+Q                                 | Ctrl+T, once set | Favicons    | Pinned tabs        |
| ---------------- | ------------------------------------- | ---------------- | ----------- | ------------------ |
| Chrome, Chromium | yes                                   | unchecked        | yes         | this window's pins |
| Helium           | yes                                   | yes              | yes         | persistent pins    |
| Edge             | yes                                   | unchecked        | yes         | this window's pins |
| Brave            | yes                                   | unchecked        | yes         | this window's pins |
| Vivaldi          | yes                                   | unchecked        | yes         | this window's pins |
| Opera            | unchecked                             | unchecked        | unchecked   | unchecked          |
| Arc, Dia         | unchecked                             | unchecked        | unchecked   | unchecked          |
| Firefox          | works in CI builds; not published yet | unchecked        | letter tile | this window's pins |

## Decided gaps

- **Firefox can't open some addresses:** it refuses to let an extension open `file:`, `about:`, `chrome:`, `data:` and similar addresses, so the Firefox build leaves those history entries and bookmarks out of results. Typed addresses with those schemes still show; opening one fails and Aloft closes. Bookmarklets (`javascript:`) are left out in every browser, since an extension can't run them.
- **Private windows:** not checked yet in any browser. Aloft has no `incognito` key, so it runs as each browser's default (spanning in Chromium when allowed in private windows).
- **Firefox favicons:** Firefox has no local favicon cache an extension can read. A tab's `favIconUrl` is nearly always the site's own address, and loading it would be a network request, so every result gets its letter tile. Tabs whose `favIconUrl` is a `data:` URL could show it without a request, but they're rare enough that it isn't done yet.

## Firefox findings

From a prototype build run in Firefox 160:

- **The overlay frame has no `tabs`, `history`, `bookmarks` or `sessions`.** Firefox gives an extension page inside a website's iframe only content-script APIs. The Firefox build relays these calls through the background ([architecture.md](architecture.md#the-palette-runs-in-an-iframe)).
- **A strict page CSP doesn't block the overlay:** with `frame-src 'none'` the frame still loads.
- **No `_favicon` cache**, so the favicon gap below applies.
- **Manifest:** Firefox needs `browser_specific_settings.gecko` with an id, `strict_min_version` and `data_collection_permissions: { required: ["none"] }`. The Chromium-only keys (`minimum_chrome_version`, `favicon`, `use_dynamic_url`) stay out of it.
- **Testing:** Puppeteer installs the extension with `installExtension` over WebDriver BiDi. Reaching `moz-extension://` pages needs `MOZ_REMOTE_ALLOW_SYSTEM_ACCESS=1` in Firefox's environment, and a fixed internal id comes from the `extensions.webextensions.uuids` pref.

## Adding a browser or a feature

- A new feature lists, in its PR body, the browsers it was tested in.
- A gap goes in the tables above, with the reason, in the same PR that adds the feature.
- A browser difference is handled by checking that an API exists, or, for Firefox, in `platform/` behind `import.meta.env.FIREFOX`. Never by checking which browser it is.
