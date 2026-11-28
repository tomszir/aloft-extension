# Architecture

Aloft is a Manifest V3 extension built with [WXT](https://wxt.dev). Its main job is a floating command bar that opens over the current page with Alt+Q, or Ctrl+T once the user assigns it.

## The palette runs in an iframe

The palette shows tab titles, history and bookmarks. Anything drawn into a web page's DOM, shadow roots included, can be read by that page's scripts. So the overlay is an extension page (`palette.html`) inside a transparent, full-viewport iframe:

- **Private:** the page can't read a cross-origin extension frame.
- **One code path:** `palette.html` is the overlay, the new-tab fallback and the settings preview.
- **No relay in Chromium:** extension pages inside a frame can call `chrome.tabs`, `history`, `bookmarks`, `sessions` and `search` directly.
- **Relay in Firefox:** an extension page framed inside a website gets only content-script APIs (`runtime`, `storage`, `i18n`), with no `tabs`, `history`, `bookmarks` or `sessions`. So in the Firefox build the overlay palette asks the background for results and actions over `runtime` messaging, and a long-lived port carries tab events back. The page can't see that traffic. The palette imports everything from `platform/palette-api.ts`, which uses the relay (`platform/relay.ts`, served by `relay-host.ts`) only in the Firefox build and only when `browser.tabs` is missing, so the palette's UI code is the same in both builds and Chromium builds don't contain the relay. The background answers only Aloft's own `palette.html`, and takes the host tab from the message's sender. The new-tab fallback and the settings preview aren't framed by a website, so they call the APIs directly there too.
- **No flash while it loads:** the frame stays invisible until the palette has loaded, `palette.html` declares `light dark` in its own `<head>` so its first paint matches the iframe, and the palette draws nothing until settings are read, so it never paints the default theme first.
- **Dimming** is the frame's own background, so it follows the theme. **Blur** is set on the iframe element in the page's document, because a filter inside the frame can't reach the page behind it.
- **Small injected script:** the background reads settings and passes the overlay script only what it needs, so settings parsing and its libraries stay out of the code injected into pages.
- **Closing:** the palette talks to its host content script with `chrome.tabs.sendMessage` (in Firefox, through the background relay), never `window.postMessage`, which the page could see.
- **Settings preview:** the same frame, styled like the overlay's (transparent, `light dark`, blur outside it), over a stand-in page. With "Match system", the settings page shows either theme by putting `#light` or `#dark` in the frame's address: a hash change doesn't reload it, and changing the frame's own color scheme instead would make Chrome paint it opaque.
- **Closed shadow root:** the frame's host uses a closed shadow root, so a page can't read the frame's address (in Firefox it carries an id fixed for the install). The e2e build leaves it open, as Playwright can only reach the frame through an open one. The frame's load doesn't show in the page's resource timing in either browser.
- **Not detectable by URL:** `palette.html` is web-accessible with `use_dynamic_url`. Firefox doesn't need it: its `moz-extension://` addresses already use a random id per install.

## How Aloft opens

Aloft opens only from its keyboard shortcuts, which grant `activeTab` for the tab they're pressed on, so it needs no access to any site.

| Trigger                                              | How                                                                     |
| ---------------------------------------------------- | ----------------------------------------------------------------------- |
| Alt+Q (`open-aloft` command)                         | the background injects the overlay into the active tab                  |
| A second shortcut, e.g. Ctrl+T (`open-aloft-second`) | the same; it has no suggested key, so it's unset until the user sets it |
| `chrome://` pages, the Web Store, the PDF viewer     | injection fails, so the palette opens as a tab of its own next to it    |

**Why Ctrl+T is the user's to set:** browsers don't let an extension suggest Ctrl+T, but a person can assign it on the browser's shortcuts page (`chrome://extensions/shortcuts`), and it then takes the place of the browser's own new tab. Onboarding and settings walk through it and see it's set by reading `commands.getAll()`. It goes on a second command so Alt+Q keeps working. Aloft used to replace the new tab page instead and switch back to the previous tab, but the browser always showed the new tab for a moment first, so the page under the palette blinked. With Ctrl+T set this way, Aloft also offers `> New tab` for an empty tab.

## Typing while it opens

Keys sent into a frame that's still loading are lost, and keys that reach the page can set off its own shortcuts. So:

- **Held from the start:** the script that hands the overlay its options (`prepareInPage` in `platform/overlay.ts`) also starts keeping keys from the page, before the overlay is even drawn. Typed characters are held as text, with Backspace applied, and an Enter after them is kept too. Esc, function keys and anything with Ctrl, Alt or Meta pass, since they may be the browser's (AltGr counts as typing).
- **Focus moves in once the palette can take keys:** the overlay focuses the frame when the palette first asks for the held text, which it does once its search box exists, not on the frame's `load` (the palette reads settings before it draws). The palette then focuses its input as its window gets focus: a cross-origin frame can't take focus by itself, so its own early `focus()` call does nothing.
- **Handed over by messaging:** the palette asks the overlay for the held text (`takeTyped`, extension messaging like closing) and puts it in front of anything typed since, a character at a time and once the stored keywords are in, so `yt ` still makes the YouTube chip. A held Enter runs on the top row once that text's searches have answered, or after a second. Enter pressed in the palette before the searches for the text have answered waits for them too, up to 300 ms, unless a row was picked; a second Enter while the first is still opening is ignored. It asks again whenever the frame gets focus back, which also covers a key that reached the page after focus left the frame.
- **Inside the palette**, typing on a pin or in its menu moves to the search box, and with nothing focused after a click on the panel, keys act as if typed there.

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
- **Tested in** Helium and plain Chromium (`ALOFT_BROWSER`) with Playwright (`tests/e2e`), and in Firefox with Puppeteer (`tests/e2e-firefox`), which installs the extension over WebDriver BiDi because Playwright can't load extensions into Firefox. Both run under Playwright's test runner as separate projects, and `pnpm test:e2e` runs both.

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
  demo/          The web demo (docs/demo.md): stand-ins for platform/, the tour, and its own build's entry. Not part of the extension.
```

Biome enforces the boundaries (see `overrides` in `biome.json`):
- `core/` imports neither `platform/`, `ui/`, Solid nor WXT, and never touches the `chrome`/`browser` globals.
- `platform/` never imports UI code.
- Nothing in the extension imports `demo/`, and `demo/` never touches the `chrome`/`browser` globals or WXT.

## Styling

- **Naming:** files and CSS classes are kebab-case. Components import their `*.module.css` and read the classes in camelCase (`styles.inputRow`).
- **Scoping:** every component's styles are a CSS Module, so class names can't leak into or collide with other components. The `.module.css` suffix is what tells Vite to scope a file.
- **Tokens only:** component CSS uses only `--al-*` variables, never raw colors or sizes. Static tokens live in `src/ui/tokens.css`; theme tokens are set at runtime because users can edit them.
- **Page styles:** page-level styles (html/body, the backdrop) live next to their entrypoint, e.g. `src/entrypoints/palette/page.css`.

## Data

- **Settings:** in `storage.sync`, as one versioned item. Every read goes through `normalizeSettings` (`src/core/settings.ts`), which keeps valid fields and resets invalid ones one at a time.
- **Learned picks:** in `storage.local`, never synced, because they're browsing data: the text typed and the page picked for it (`src/core/learned.ts`). Each pick fades by half every two weeks, and picking another page for the same text halves the old one. A page leads once it has about two recent picks and twice the score of the next one; it then goes above the search row, as its open tab when there is one. The store keeps at most 400 picks, and is validated on every read like settings.
- **Best match:** without a learned pick or an address, a page that plainly starts with what's typed (two characters or more) goes above "Search the web", so Enter opens it: an open tab or bookmark by its title, or any page by its site, as the address bar completes "gi" to github.com. History titles don't count, so "how to" still searches. Rows show addresses with the path's escapes decoded; the host stays as it is, so a lookalike can't pass for a site.
- **Scopes:** `@tabs`, `@bookmarks` or `@history` (or the singular) and Space narrow the search to one source, as a chip like a keyword's (`src/core/query.ts`). The names are everyday words ("tabs vs spaces", "history of rome"), so unlike keywords they make a chip only with the "@"; a keyword of the user's own with the same name wins. They head the "@" list, under their own label, and a source switched off in settings has none. Inside one there's no search, address or best-match row: with nothing typed it lists the most recent tabs, newest bookmarks or latest history, and otherwise ranks that source as the mixed list does, with up to 50 rows instead of its few. Learned picks still lift pages in a scope, but none goes above the rest, and a pick made in a scope isn't learned: chosen among fewer pages, it says less about what the text means everywhere else.
- **Matching:** the browser's history and bookmark searches match whole words only, so Aloft also reads the 500 most recent history entries when it opens, and every bookmark 150 ms later, and matches them itself. Reading every bookmark takes the browser about 25 ms for 5,000 and 95 ms for 20,000, and asking while the palette loads delays it appearing; until the list arrives, the browser's bookmark search covers what's typed, and after that it's skipped. Matching itself costs about 3 ms per keystroke for 5,000 bookmarks. Aloft matches by substring, by initials ("wr" for Window Rules) and, for terms of four or more letters, by one typo (two for eight or more) at the start of a word (`src/core/match.ts`).
- **What's new:** `CHANGELOG.md` is bundled into the background and the settings page (`core/releases.ts`), never the palette. On an update, the background stores the version it came from in `storage.local` (`platform/whats-new.ts`), but only when a release since then says more than small fixes; nothing opens. The first time Aloft opens after that, its footer shows a quiet "What's new" link to them, unless that's switched off in settings; it's never shown again for that update. The settings page marks the releases since then as new until it has shown them, for up to two weeks.
- **Themes:** six colors plus a corner radius (`src/core/theme.ts`). The other UI tokens are derived from those. Custom themes are their own sync item (`platform/themes.ts`), at most 16 so they fit its 8 KB, normalized on every read like settings. A theme being edited is shown only in the settings preview, through the frame's hash, and written when saved, so dragging a color picker doesn't spend sync's write quota. Imported theme JSON is untrusted: it's size-limited, schema-checked with valibot, gets a fresh id, and opens in the editor before it's saved. Text contrast is checked against WCAG 4.5:1.
- **Font and density** are appearance settings, not part of a theme. Fonts are only ones already installed (a few stacks, or a name typed in, restricted to characters that can't escape its CSS quotes), since Aloft makes no network requests. Density scales the palette's text and row sizes; the settings pages keep theirs.
- **Privacy:** Aloft makes no network requests and collects nothing. Everything stays in the browser.

## Quality bar

- **TypeScript and lint:** `strict` and `noUncheckedIndexedAccess`; no `any` and no non-null assertions (Biome).
- **Unit tests:** Vitest, run once per build target (the `chromium` and `firefox` projects), so code behind `import.meta.env.FIREFOX` is tested in both builds. `core/` is covered thoroughly. `platform/` is tested with WXT's `fakeBrowser`, and UI with `@solidjs/testing-library`.
- **End-to-end tests:** Playwright loads the built extension.
- **Accessibility:** WAI-ARIA combobox and listbox pattern, and Esc gives focus back to the page.
- **Web demo:** the palette also runs on an ordinary page, over an invented browser in memory, for Aloft's product page. It's a separate build that swaps `platform/` for fakes, so the extension's packages don't change; see [demo.md](demo.md).
- **Budgets:** palette JS under 42 KB gzipped (raised from 40 for themes, density and the readable-address and best-match work; keep it tight), overlay content script under 5 KB, the web demo under 46 KB, first results in under 50 ms.
