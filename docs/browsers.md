# Browser support

Every feature has to work in every Tier 1 browser, or leave out a part on purpose, recorded here and covered by a test. How the code handles the differences: [architecture.md](architecture.md#browser-support).

## Tiers

| Tier                 | Browsers                                                     | Package                                                 | Tested                                                            |
| -------------------- | ------------------------------------------------------------ | ------------------------------------------------------- | ----------------------------------------------------------------- |
| **1: Chromium**      | Chrome, Helium, Brave, Edge, Vivaldi, Opera, Arc, Dia        | the Chrome zip (Chrome Web Store; Edge Add-ons planned) | e2e in Chromium and Helium; the others by hand before a release   |
| **1: Firefox**       | Firefox (current ESR and newer)                              | the Firefox zip (addons.mozilla.org, planned)           | by hand with `web-ext` until automated e2e exists                 |
| **2: Firefox forks** | Zen, LibreWolf, Floorp, Waterfox                             | the Firefox zip                                         | best-effort: bugs are fixed when they don't hurt a Tier 1 browser |
| **Not supported**    | Safari, Orion, mobile browsers, Tor Browser, Mullvad Browser | none                                                    | none                                                              |

Why some browsers aren't supported:

- **Safari and Orion** (WebKit) have no `history`, `bookmarks`, `search` or favicon APIs, which is most of what Aloft searches.
- **Mobile browsers** have no keyboard shortcuts (`commands`), which is how Aloft opens.
- **Tor Browser and Mullvad Browser** ask users not to install extensions, because each one makes them easier to fingerprint.

## What works where

"Unchecked" means not tried yet. Replace it with the result once someone has checked.

| Browser          | Alt+Q     | Ctrl+T                                                                                | Favicons                                      | Pinned tabs        |
| ---------------- | --------- | ------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------ |
| Chrome, Chromium | yes       | yes                                                                                   | yes                                           | this window's pins |
| Helium           | yes       | yes                                                                                   | yes                                           | persistent pins    |
| Edge             | yes       | unchecked (Edge asks once to keep the new tab page)                                   | yes                                           | this window's pins |
| Brave            | yes       | unchecked                                                                             | yes                                           | this window's pins |
| Vivaldi          | yes       | only with Settings → Tabs → New Tab Page set to "Controlled by extension" (unchecked) | yes                                           | this window's pins |
| Opera            | unchecked | unchecked (may not allow a new tab override)                                          | unchecked                                     | unchecked          |
| Arc, Dia         | unchecked | unchecked (Cmd+T opens the browser's own command bar)                                 | unchecked                                     | unchecked          |
| Firefox          | planned   | planned                                                                               | letter tile unless the tab has a `data:` icon | this window's pins |

## Decided gaps

- **Firefox favicons:** Firefox has no local favicon cache an extension can read. A tab's `favIconUrl` is often a remote address, and loading it would be a network request, so Aloft uses it only when it's a `data:` URL and shows a letter tile otherwise. History and bookmark results always get the tile.

## Adding a browser or a feature

- A new feature lists, in its PR body, the browsers it was tested in.
- A gap goes in the tables above, with the reason, in the same PR that adds the feature.
- A browser difference is handled by checking that an API exists, or, for Firefox, in `platform/` behind `import.meta.env.FIREFOX`. Never by checking which browser it is.
