# What's new in Aloft

<!-- Each release's notes, newest first, for the people using Aloft. A draft is
     added on the release PR (scripts/release-notes.ts); rewrite it in plain
     words before merging. See docs/releasing.md. -->

## 1.0.1 — 27 November 2026

- Small fixes and improvements.

## 1.0.0 — 27 November 2026

Aloft 1.0 opens over the page you're on without losing a key you type, and it can now look however you like.

- **Breaking:** Aloft no longer takes over new tabs. Alt+Q opens it over the page you're on, and so does Ctrl+T once you give it to Aloft on your browser's shortcuts page. If you used Ctrl+T, Aloft shows you how to set it up again after this update.

### Opening Aloft

- Everything you type while Aloft opens is kept, even a keyword, or Enter, which opens the top result as soon as it's in.
- Opening Aloft with Ctrl+T no longer flashes the page white.
- Typing goes to the search box wherever you are in Aloft, and Tab, Esc and the arrow keys stay inside it, input methods included. On a Mac, symbols typed with Option no longer open pinned tabs.
- Aloft's shortcut also works on its own settings and welcome pages, opening Aloft beside them.

### Appearance and settings

- Make your own themes: choose the colors and corners, see whether text stays readable as you go, and share a theme as a file.
- Pick any font installed on your computer, and how compact Aloft is.
- Settings has a new layout, with a full-size live preview beside it, a menu to jump between sections, and switches you can flip by clicking anywhere on their row. It also works better from the keyboard, and asks before you delete a theme or leave unsaved changes.
- After an update, Aloft mentions what's new once, at the bottom. You can switch that off, and settings lists what changed in each version.

### Results

- A tab or site whose name starts with what you type now comes first, above the web search.
- Press Delete to close an open tab right from the results.
- Tabs in another window are marked, and the page you're on no longer shows up in results.
- Addresses with spaces and accents read normally instead of as escape codes.
- Switching to a page that's already open closes Aloft, and pressing Enter twice opens a result only once.
- In Helium, typed helium:// addresses open instead of asking for an outside app.

### Actions

- Type > to open your browser's history, downloads, bookmarks, passwords, extensions, extension shortcuts, settings or clear browsing data. Firefox doesn't let extensions open these pages, so they aren't offered there.
- The Open settings action is now called Aloft settings.

### Privacy and sync

- Settings has a Privacy section that says what Aloft reads, that nothing leaves your browser and what syncs, with the switch for what Aloft learns beside it. The bottom of settings links to Aloft's source and who makes it.
- Saving settings keeps any that a newer Aloft on another of your devices added.
- Websites can no longer see the address Aloft loads from.

## 0.5.0 — 25 November 2026

- Aloft has a new name in the Chrome Web Store: Aloft – Command Bar for Tabs & History. In your browser it's still just Aloft.

## 0.4.1 — 24 November 2026

- Ctrl+T no longer flashes a blank new tab before Aloft appears, and you can start typing straight away.
- The Change shortcut button now works in Firefox.

## 0.4.0 — 24 November 2026

- Aloft now works in Firefox too, over the page you're on, just like in Chromium browsers.
- Search learns which page you pick for what you type, and puts it first next time.
- Search also matches initials, like "wr" for Window Rules, and forgives a typo in longer words.
- Type @ to see every keyword and pick one.
- The selected row shows where Enter will open it, and the footer only shows the keys you need.
- The selection slides between rows, and Aloft fades out when it closes.
- Ctrl+T opens Aloft reliably in browsers that report new tabs late.
- Site icons no longer flash while you type.

## 0.3.0 — 24 November 2026

- Keywords: type yt, gh, cl or gpt and Space to search YouTube or GitHub, or ask Claude or ChatGPT, right from the bar.
- Add your own keywords, and edit, switch off or reset them in settings.
- Drag pinned tabs to put them in a different order.
- Pinned tabs have labels, and tabs that are asleep show as hollow tiles, so you can tell them apart.
- Black and white site icons stay visible in both dark and light themes.

## 0.2.0 — 24 November 2026

- A settings page, with a live preview of Aloft as you change things.
- Matching words are bold in results, and pages without an icon get a letter tile instead.
- Typing > shows actions mode as a chip, with only the keys that work there.
- Aloft opens above the dialogs and popups that sites show.
- Aloft keeps your system's light or dark theme on every site, and the page stays visible behind it.

## 0.1.0 — 24 November 2026

The first version of Aloft.

- Press Ctrl+T or Alt+Q and a search bar floats over the page you're on.
- One search for open tabs, history, bookmarks and recently closed tabs. Type an address to go straight to it, or anything else to search the web.
- Your pinned tabs sit at the top, and Alt+1 to 9 opens them.
- Type > to pin, duplicate, move or close tabs, or reopen a closed one.
- Esc puts you back exactly where you were.
