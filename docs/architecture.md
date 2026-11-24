# Architecture

Aloft is a Manifest V3 extension built with [WXT](https://wxt.dev). Its main job is a floating command bar that opens over the current page with Ctrl+T or Alt+Q.

## The palette runs in an iframe

The palette shows tab titles, history and bookmarks. Anything drawn into a web page's DOM, shadow roots included, can be read by that page's scripts. So the overlay is an extension page (`palette.html`) inside a transparent, full-viewport iframe:

- **Private:** the page can't read a cross-origin extension frame.
- **One code path:** `palette.html` is the overlay, the new-tab fallback and the settings preview.
- **No relay in Chromium:** extension pages inside a frame can call `chrome.tabs`, `history`, `bookmarks`, `sessions` and `search` directly.
- **Relay in Firefox:** an extension page framed inside a website gets only content-script APIs (`runtime`, `storage`, `i18n`), with no `tabs`, `history`, `bookmarks` or `sessions`. So in the Firefox build the overlay palette asks the background for results and actions over `runtime` messaging, and a long-lived port carries tab events back. The page can't see that traffic. The palette imports everything from `platform/palette-api.ts`, which uses the relay (`platform/relay.ts`, served by `relay-host.ts`) only in the Firefox build and only when `browser.tabs` is missing, so the palette's UI code is the same in both builds and Chromium builds don't contain the relay. The background answers only Aloft's own `palette.html`, and takes the host tab from the message's sender. The new-tab fallback and the settings preview aren't framed by a website, so they call the APIs directly there too.
- **Dimming** is the frame's own background, so it follows the theme. **Blur** is set on the iframe element in the page's document, because a filter inside the frame can't reach the page behind it.
- **Small injected script:** the background reads settings and passes the overlay script only what it needs, so settings parsing and its libraries stay out of the code injected into pages.
- **Closing:** the palette talks to its host content script with `chrome.tabs.sendMessage` (in Firefox, through the background relay), never `window.postMessage`, which the page could see.
- **Not detectable by URL:** `palette.html` is web-accessible with `use_dynamic_url`. Firefox doesn't need it: its `moz-extension://` addresses already use a random id per install.

## How Aloft opens

| Trigger                                                     | How                                                                                                                                 | Permission                                              |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Alt+Q (`open-aloft` command)                                | background injects the overlay host into the active tab                                                                             | `activeTab`, granted by the shortcut                    |
| Ctrl+T / New Tab button                                     | the new tab page is overridden; `tabs.onCreated` sees it, injects the overlay into the previously active tab and closes the new tab | optional `<all_urls>`, asked for on the onboarding page |
| Ctrl+L (opt-in)                                             | a small content script, registered only while the setting is on                                                                     | same optional `<all_urls>`                              |
| `chrome://` pages, Web Store, PDF viewer, or no site access | injection fails, so the new tab stays and shows the palette full page                                                               | none                                                    |

MV3 service workers keep no memory between wake-ups, so the previously active tab for each window is kept in `storage.session`.

## Pinned tabs

Helium 0.22.2+ has persistent pins ([imputnet/helium#2931](https://github.com/imputnet/helium/pull/2931)): they're shared by every window, kept across restarts, and remember their address. Aloft keeps no list of its own. It shows the pinned tabs as a row at the top of the palette (Alt+1–9), with open, move and unpin.

In other Chromium browsers pins belong to one window, so the row shows that window's pins. Nothing in Aloft depends on Helium's behavior.

- **One window's copies:** Helium gives every window its own tab for each pin, so the row always uses the host window's pins.
- **Loaded or asleep:** a pin counts as loaded when it isn't `discarded` and its status is `complete`. Helium's hibernated pins report `loading` with a `pendingUrl` and no page; Chrome's sleeping tabs report `unloaded`. Both read as asleep.
- **Ids change:** hibernating or discarding replaces the tab with a new id, so the palette re-reads tabs on every tab event instead of tracking ids.
- **Alt+1–9:** on Linux, Chromium also uses Alt+1–8 to switch tabs, but it isn't a reserved shortcut, so the page sees it first. Aloft cancels it only when that slot has a pin; an empty slot falls through to the browser.

## Browser support

Which browsers are supported, and what each one can't do: [browsers.md](browsers.md). Helium reports itself as Google Chrome (same user agent and brand list) to resist fingerprinting, so Aloft can't tell them apart, and doesn't try.

- **No browser sniffing.** Nothing checks which browser it's in. Every feature must behave correctly in any Chromium browser.
- **Check that an API exists** before relying on one that some browsers lack.
- **Firefox differences are decided at build time:** WXT builds a separate Firefox package and sets `import.meta.env.FIREFOX`. Branches on it live in `platform/` only, so each build drops the other's code.
- **Copy is browser-neutral.** UI text never claims something only one browser does (for example "Helium keeps pins in every window"). The store description is the one place Helium is named on purpose.
- **Tested in** Helium and plain Chromium (`ALOFT_BROWSER`) with Playwright. Playwright can't load extensions into Firefox, so Firefox gets its own end-to-end tests with Puppeteer, which installs the extension over WebDriver BiDi. Until those exist, Firefox is checked by hand with `web-ext`.

## Layers

```
src/
  entrypoints/   WXT entrypoints. Wiring only.
  core/          Plain TypeScript logic: query parsing, ranking, settings, themes. No browser APIs.
  platform/      Thin adapters over chrome.* APIs, behind interfaces so tests can fake them.
  ui/            Solid components shared by the palette and the settings page.
    tokens.css             static design tokens (spacing, type, motion)
    theme/apply-theme.ts   theme colors and radii, set at runtime as CSS variables
    <component>/<component>.tsx, <component>.module.css, <component>.test.tsx
  locales/       Strings (@wxt-dev/i18n). All UI text goes through here.
```

Biome enforces the boundaries (see `overrides` in `biome.json`):
- `core/` imports neither `platform/`, `ui/`, Solid nor WXT, and never touches the `chrome`/`browser` globals.
- `platform/` never imports UI code.

## Styling

- **Naming:** files and CSS classes are kebab-case. Components import their `*.module.css` and read the classes in camelCase (`styles.inputRow`).
- **Scoping:** every component's styles are a CSS Module, so class names can't leak into or collide with other components. The `.module.css` suffix is what tells Vite to scope a file.
- **Tokens only:** component CSS uses only `--al-*` variables, never raw colors or sizes. Static tokens live in `src/ui/tokens.css`; theme tokens are set at runtime because users can edit them.
- **Page styles:** page-level styles (html/body, the backdrop) live next to their entrypoint, e.g. `src/entrypoints/palette/page.css`.

## Data

- **Settings:** in `storage.sync`, as one versioned item. Every read goes through `normalizeSettings` (`src/core/settings.ts`), which keeps valid fields and resets invalid ones one at a time.
- **Learned picks:** in `storage.local`, never synced, because they're browsing data: the text typed and the page picked for it (`src/core/learned.ts`). Each pick fades by half every two weeks, and picking another page for the same text halves the old one. A page leads once it has about two recent picks and twice the score of the next one; it then goes above the search row, as its open tab when there is one. The store keeps at most 400 picks, and is validated on every read like settings.
- **Matching:** the browser's history and bookmark searches match whole words only, so Aloft also reads the 500 most recent history entries when it opens, and every bookmark 150 ms later, and matches them itself. Reading every bookmark takes the browser about 25 ms for 5,000 and 95 ms for 20,000, and asking while the palette loads delays it appearing; until the list arrives, the browser's bookmark search covers what's typed, and after that it's skipped. Matching itself costs about 3 ms per keystroke for 5,000 bookmarks. Aloft matches by substring, by initials ("wr" for Window Rules) and, for terms of four or more letters, by one typo (two for eight or more) at the start of a word (`src/core/match.ts`).
- **Themes:** six colors plus a corner radius (`src/core/theme.ts`). The other UI tokens are derived from those. Imported theme JSON is untrusted: it's size-limited, schema-checked with valibot, and gets a fresh id. Text contrast is checked against WCAG 4.5:1.
- **Privacy:** Aloft makes no network requests and collects nothing. Everything stays in the browser.

## Quality bar

- **TypeScript and lint:** `strict` and `noUncheckedIndexedAccess`; no `any` and no non-null assertions (Biome).
- **Unit tests:** Vitest. `core/` is covered thoroughly. `platform/` is tested with WXT's `fakeBrowser`, and UI with `@solidjs/testing-library`.
- **End-to-end tests:** Playwright loads the built extension.
- **Accessibility:** WAI-ARIA combobox and listbox pattern, and Esc gives focus back to the page.
- **Budgets:** palette JS under 40 KB gzipped, overlay content script under 5 KB, first results in under 50 ms.
