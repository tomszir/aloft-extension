# Browser support

Every feature has to work in every Tier 1 browser, or leave out a part on purpose, recorded here and covered by a test. How the code handles the differences: [architecture.md](architecture.md#browser-support).

## Tiers

| Tier                 | Browsers                                                     | Package                                                 | Tested                                                            |
| -------------------- | ------------------------------------------------------------ | ------------------------------------------------------- | ----------------------------------------------------------------- |
| **1: Chromium**      | Chrome, Helium, Brave, Edge, Vivaldi, Opera, Arc, Dia        | the Chrome zip (Chrome Web Store; Edge Add-ons planned) | e2e in Chromium and Helium; the others by hand before a release   |
| **1: Firefox**       | Firefox 140 (the current ESR) and newer                      | the Firefox zip (addons.mozilla.org, planned)           | e2e with Puppeteer (planned); by hand with `web-ext` until then   |
| **2: Firefox forks** | Zen, LibreWolf, Floorp, Waterfox                             | the Firefox zip                                         | best-effort: bugs are fixed when they don't hurt a Tier 1 browser |
| **Not supported**    | Safari, Orion, mobile browsers, Tor Browser, Mullvad Browser | none                                                    | none                                                              |

Why some browsers aren't supported:

- **Safari and Orion** (WebKit) have no `history`, `bookmarks`, `search` or favicon APIs, which is most of what Aloft searches.
- **Mobile browsers** have no keyboard shortcuts (`commands`), which is how Aloft opens.
- **Tor Browser and Mullvad Browser** ask users not to install extensions, because each one makes them easier to fingerprint.

## What works where

"Unchecked" means not tried yet. Replace it with the result once someone has checked.

| Browser          | Alt+Q                                 | Ctrl+T                                                                                | Favicons                                      | Pinned tabs        |
| ---------------- | ------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------ |
| Chrome, Chromium | yes                                   | yes                                                                                   | yes                                           | this window's pins |
| Helium           | yes                                   | yes                                                                                   | yes                                           | persistent pins    |
| Edge             | yes                                   | unchecked (Edge asks once to keep the new tab page)                                   | yes                                           | this window's pins |
| Brave            | yes                                   | unchecked                                                                             | yes                                           | this window's pins |
| Vivaldi          | yes                                   | only with Settings → Tabs → New Tab Page set to "Controlled by extension" (unchecked) | yes                                           | this window's pins |
| Opera            | unchecked                             | unchecked (may not allow a new tab override)                                          | unchecked                                     | unchecked          |
| Arc, Dia         | unchecked                             | unchecked (Cmd+T opens the browser's own command bar)                                 | unchecked                                     | unchecked          |
| Firefox          | works in CI builds; not published yet | works in CI builds; not published yet                                                 | letter tile unless the tab has a `data:` icon | this window's pins |

## Decided gaps

- **Firefox favicons:** Firefox has no local favicon cache an extension can read. A tab's `favIconUrl` is often a remote address, and loading it would be a network request, so Aloft uses it only when it's a `data:` URL and shows a letter tile otherwise. History and bookmark results always get the tile.

## Firefox findings

From a prototype build run in Firefox 160:

- **The overlay frame has no `tabs`, `history`, `bookmarks` or `sessions`.** Firefox gives an extension page inside a website's iframe only content-script APIs. The Firefox build relays these calls through the background ([architecture.md](architecture.md#the-palette-runs-in-an-iframe)).
- **Ctrl+T:** `tabs.onCreated` reports the new tab as `about:blank` with no `pendingUrl`; the new tab page's address only arrives in a later `tabs.onUpdated`. The new-tab intercept has to listen there too, and handle each tab once.
- **A strict page CSP doesn't block the overlay:** with `frame-src 'none'` the frame still loads.
- **No `_favicon` cache**, so the favicon gap below applies.
- **Manifest:** Firefox needs `browser_specific_settings.gecko` with an id, `strict_min_version` and `data_collection_permissions: { required: ["none"] }`. The Chromium-only keys (`minimum_chrome_version`, `favicon`, `use_dynamic_url`) stay out of it.
- **Testing:** Puppeteer installs the extension with `installExtension` over WebDriver BiDi. Reaching `moz-extension://` pages needs `MOZ_REMOTE_ALLOW_SYSTEM_ACCESS=1` in Firefox's environment, and a fixed internal id comes from the `extensions.webextensions.uuids` pref.

## Adding a browser or a feature

- A new feature lists, in its PR body, the browsers it was tested in.
- A gap goes in the tables above, with the reason, in the same PR that adds the feature.
- A browser difference is handled by checking that an API exists, or, for Firefox, in `platform/` behind `import.meta.env.FIREFOX`. Never by checking which browser it is.
