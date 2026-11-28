# Web demo

A version of Aloft's palette that runs in an ordinary web page, so people can try it before installing. It's the extension's own palette code (`src/entrypoints/palette/app.tsx` and everything in `src/ui` it draws) over an invented browser held in memory, with a short guided tour on top. Aloft's product page loads it behind a "Try Aloft" button.

It's one ES module with its styles and strings inside, published with every GitHub release. The extension's packages don't contain it and don't change because of it: it has its own build, and `pnpm build` gives the same files with or without it.

## Commands

| Task                      | Command                                                           |
| ------------------------- | ----------------------------------------------------------------- |
| Build it                  | `pnpm demo:build` → `.output/demo/`                               |
| Try it on a stand-in page | `pnpm demo:dev`, then open http://127.0.0.1:4178/                 |
| Unit tests                | `pnpm test` (the `demo` project)                                  |
| End-to-end tests          | `pnpm test:e2e` (the `demo-chromium` and `demo-firefox` projects) |
| Size budget               | `pnpm size` after the build                                       |

`pnpm demo:dev` rebuilds on every change; reload the page to see it. The page (`src/demo/dev/`) stands in for the product page: the same Content Security Policy, as a meta tag, and its fonts if they're found next to this repository (`../tomszir.com/src/fonts`, or set `ALOFT_DEMO_FONTS` to the folder), else system fonts. Those fonts are for local use only and are never committed here.

## Release assets

Each GitHub release from the next one on has two more files, built by `release.yml` from the tagged commit:

| File                             | What it is                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------- |
| `aloft-demo-<version>.js`        | The demo: one self-contained ES module. No other files, no imports, no assets.  |
| `aloft-demo-<version>.js.sha256` | Its SHA-256, in `sha256sum` format: 64 hex digits, two spaces, the file's name. |

They're at:

```
https://github.com/tomszir/aloft-extension/releases/download/v<version>/aloft-demo-<version>.js
https://github.com/tomszir/aloft-extension/releases/download/v<version>/aloft-demo-<version>.js.sha256
```

The site's build fetches the file for the version it pins, checks it against the hash, and serves it from its own origin, at any path: the file doesn't depend on where it's served from (it never reads `import.meta.url` or loads anything relative to itself). Visitors never contact GitHub. Builds are reproducible, so `pnpm demo:build` on the tag gives the same bytes.

The file starts with a comment naming its version and licence (GPL-3.0-only) and linking here, and also exports `version`.

## Mounting it

```ts
const { mountDemo } = await import('/aloft-demo/aloft-demo-1.1.0.js')

const demo = mountDemo(document.getElementById('aloft-demo'), {
  scheme: 'dark',
  tour: true,
  onWould: (what) => showNote(what), // "Would switch to Weekend trip — Waypoint"
  onClose: () => {},
  onFinish: () => showInstallButtons(),
})
demo.open()
```

The contract, in full:

```ts
export function mountDemo(host: HTMLElement, options?: DemoOptions): DemoHandle
export const version: string

interface DemoOptions {
  /** The page's colour scheme; "system" follows prefers-color-scheme. Default "system". */
  scheme?: 'light' | 'dark' | 'system'
  /** Start the guided tour the first time the demo opens. */
  tour?: boolean
  /** A font family already loaded on the page. Default: the first family in --font-sans, else the system font. */
  font?: string
  /** Something the extension would have done that leaves the page. */
  onWould?: (what: string) => void
  /** The bar closed (Esc, or a click outside it) and has faded out. */
  onClose?: () => void
  /** The tour's Finish was pressed. Not called when it's skipped. */
  onFinish?: () => void
}

interface DemoHandle {
  open(): void
  close(): void
  /** Start the tour over on a fresh set of tabs; opens the demo if it's closed. */
  startTour(): void
  /** Follow the page when its colour scheme changes. */
  setScheme(scheme: 'light' | 'dark' | 'system'): void
  /** Close, empty the shadow root and forget all state. */
  destroy(): void
}
```

What the host page needs to know:

- **Loading.** Import it when "Try Aloft" is pressed, not before. Mounting draws nothing and adds no listeners; `open()` does both.
- **The host element** should be empty and sit directly under `<body>`: the demo covers the viewport with `position: fixed` and `z-index: 2147483000`, which an ancestor with a `transform` or `filter` would trap. The demo attaches an open shadow root to it and puts everything inside, so no styles cross in either direction. Inherited properties stop at the host (`all: initial`); custom properties don't, which is how `--font-sans` and `--font-mono` reach it.
- **Styles** are one constructed stylesheet (`adoptedStyleSheets`), and inline styles are set through the CSSOM, which `style-src 'self'` allows. There are no `<style>` or `<script>` elements, no `eval` or `new Function`, no blob or data URLs, and no images: pages get letter tiles, not favicons. The build fails if the bundle contains `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `eval`, `new Function`, a dynamic `import()` or `import.meta`.
- **Keyboard.** While it's closed, nothing is registered. While it's open, the palette listens for `keydown`, `keyup`, `focus` and `blur` on `window`, as it does in the extension, and the demo for a `prefers-color-scheme` change; all are removed on close. Keys typed in the demo are composed events, so they also reach the page's own `document` listeners, retargeted to the host element: page shortcuts should ignore events whose target is the host.
- **Closing.** Esc leaves a keyword or `>` first, then closes the bar; so does a click outside it. The demo fades itself out (200 ms, none with reduced motion), gives focus back to whatever had it before `open()` (the "Try Aloft" button), then calls `onClose`.
- **Colour scheme.** Default themes are Instrument Dark and Instrument Light, the product page's own. With `scheme: 'system'` it follows `prefers-color-scheme`; a page with its own switch calls `setScheme` when it changes. A theme picked in the tour stays until `destroy()`.

## What it pretends

The invented browser (`src/demo/browser-state.ts`, from the sites in `src/demo/sites.ts`, which the store screenshots use too) has one window: four pinned tabs, one of them asleep; three open tabs, the first being the page the demo sits on; a recently closed tab; about twenty history entries and five bookmarks, all on `*.aloft.test`. The fake platform (`src/demo/platform/`) answers the palette from it.

Search, ranking, best matches, keywords (`yt`, `gh`, the `@` list), `>` actions, pinned tabs with Alt+1–9, the pin menu and dragging pins, the result menu (Ctrl+K or ⌘K, or a right click), Shift+Enter, learned picks and themes all run the extension's own code.

**Changes the state:** pin and unpin, duplicate, close other tabs, close duplicate tabs, reopen closed tab, closing a tab from its row (Delete) or its menu, pinning or unpinning it from its menu, removing a page from history, moving and unpinning pins, and opening a page in a new tab (it then shows among the open tabs). Switching to a tab wakes it if it was asleep. Learned picks, settings and themes are kept in memory, never in storage, until `destroy()`.

**Only reported** through `onWould`, because they'd leave the page: switching tabs ("Would switch to …"), opening a page ("Would open … in a new tab", or "in this tab" with Shift+Enter), web searches, reopening a closed tab, and the actions for a new tab or window, moving to a new window, reloading, closing, muting or bookmarking the page, the browser's own pages and Aloft's settings ("Would run “History”"). The page the demo sits on never changes.

**After acting**, the extension's bar closes. The demo's opens again straight away, as if Alt+Q had been pressed, so the change shows: a pin added by `> Pin tab` is in the row.

**Left out:** favicons (letter tiles instead), "What's new", the overlay's held typing and zoom correction (it shares the page's zoom), and the selection's slide between rows, which finds rows by `document.getElementById` and so can't see into the shadow root. Tab order and the menus' arrow keys use `document.activeElement` in the palette; the demo redoes those moves from the shadow root's focus (`src/demo/focus.ts`).

## The tour

Five steps, each with one line of instruction, a step count, Skip tour and Next (Finish on the last). The visitor does each thing in the bar, and the tour notices:

1. **Search everything**: type a word, like "hand". Moves on after a pause in typing.
2. **Jump to a pinned tab**: Alt+1, or click or tap a pin. Touch screens are only asked to tap.
3. **Type > for actions**: run one, like Pin tab.
4. **Search a site**: `yt` and Space, or `@` and pick one; done once a keyword's chip shows.
5. **Make it yours**: pick a theme. Waits for Finish, which calls `onFinish`; installing is the page's part.

Focus stays in the search box: clicking a tour button puts it back there. From the keyboard, Shift+Tab in the search box reaches the tour's controls, and Tab past them comes back. The step text is a polite live region. The tour's card is drawn in the palette's theme tokens, and its animation is off with reduced motion. Closing the demo mid-tour pauses it; opening again carries on.

Its strings are in `src/demo/locales/en.yml`, apart from the extension's so its messages don't change.

## How it's built

`vite.demo.config.ts`, with the plugins in `scripts/demo-plugins.ts`:

- **Swaps** every import of `src/platform/<name>` for `src/demo/platform/<name>`, and of `src/app/<name>` for `src/demo/app/<name>` where one exists (the theme goes on the demo's element instead of `<html>`; zoom correction is left out). A platform module with no stand-in fails the build, and so does any import of WXT or the browser APIs. Imports from inside `src/demo` reach the real modules, so a stand-in can wrap one.
- **Messages:** `#i18n` reads the extension's strings and the demo's from the bundle, keeping only keys the bundled code names.
- **Styles:** the CSS is taken out of its file and into the script, `:root` becoming `:host`.
- **Release files:** the versioned copy and its hash, after checking the bundle against the list above.

The demo's unit tests run as their own Vitest project with the same swaps, and fail on any touch of `browser` or `chrome`.

## Budget

**44.1 KB gzipped** at 1.0.0 (level 9, as `pnpm size` measures; Vite's build output says about 45.7 KB), against a budget of **47 KB**. The palette page's budget is 44 KB, but its CSS and strings are separate files; here they're inside, about 5.5 KB between them. `pnpm size` checks it whenever `.output/demo` exists, and CI builds it on every PR.
