# Chrome Web Store listing

The text and answers for the Web Store developer dashboard, kept here so they change with the features they describe. Fields are in the order the dashboard asks for them.

## Store listing

**Name:** Aloft (from `extName` in `src/locales/en.yml`)

**Summary** (from `extDescription`, at most 132 characters):

> A floating command bar for Helium and other Chromium browsers.

**Description:**

> Press Ctrl+T and, instead of a blank tab, a search bar floats over the page you're on. Type to find what you need, press Enter, and you're there. Esc puts you back exactly where you were.
>
> ONE SEARCH FOR EVERYTHING
> Open tabs in every window, history, bookmarks and recently closed tabs, ranked together, with what matched marked in each result. Type an address to go straight to it, or anything else to search the web with your default search engine.
>
> PINNED TABS, ONE KEY AWAY
> Your pinned tabs sit at the top of the bar. Alt+1 to Alt+9 opens them.
>
> TAB ACTIONS
> Type > to pin or duplicate the tab, move it to a new window, close other tabs, reopen a closed one or open settings, all without the mouse.
>
> LOOKS LIKE YOUR BROWSER
> Light and dark follow your system, with six built-in themes. The settings page shows a live preview of every change.
>
> PRIVATE BY DESIGN
> Aloft makes no network requests and collects nothing. Your tabs, history and bookmarks are only read on your device, while the bar is open, and the bar runs in a frame that web pages can't read.
>
> WORKS WITHOUT EXTRA ACCESS
> Alt+Q opens Aloft on any page with no extra permissions. Allowing access to all sites, which Aloft asks for once, lets Ctrl+T open it over the current page too; without it, Ctrl+T shows Aloft as the new tab page.
>
> Made for Helium, and works in any Chromium browser. Open source: github.com/tomszir/aloft-extension

**Category:** Productivity → Tools

**Language:** English

### Graphics

| Asset              | Size     | File                                                                |
| ------------------ | -------- | ------------------------------------------------------------------- |
| Store icon         | 128×128  | `public/icon/128.png`                                               |
| Screenshots        | 1280×800 | `docs/screenshots/1-pinned-and-tabs.png` … `5-themes.png`, in order |
| Small promo tile   | 440×280  | `assets/brand/promo-440x280.png`                                    |
| Marquee promo tile | 1400×560 | `docs/screenshots/marquee-1400x560.png`                             |

All of them are generated: the screenshots and marquee tile by `pnpm screenshots`, the icon and small tile by `pnpm brand`. The promo video (`pnpm video`, see `video/`) goes on YouTube for the listing's video field.

### Additional fields

- **Official URL:** none
- **Homepage URL:** https://github.com/tomszir/aloft-extension
- **Support URL:** https://github.com/tomszir/aloft-extension/issues

## Privacy practices

**Single purpose:**

> Aloft is a command bar for finding and switching to tabs, history and bookmarks, and for acting on the current tab, from a search box that opens over the page.

**Permission justifications** (the same reasons as [permissions.md](permissions.md)):

| Permission  | Justification                                                                                                                                               |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tabs`      | Reads the titles and addresses of open tabs so they can be searched and switched to, and shows pinned tabs at the top of the bar.                           |
| `history`   | Searches the user's history for what they type.                                                                                                             |
| `bookmarks` | Searches the user's bookmarks for what they type.                                                                                                           |
| `sessions`  | Lists recently closed tabs and reopens the one the user picks.                                                                                              |
| `search`    | Sends the typed text to the browser's default search engine when the user picks "Search the web".                                                           |
| `storage`   | Saves the user's settings.                                                                                                                                  |
| `scripting` | Adds the frame that shows the command bar to the page the user is on, when they open Aloft.                                                                 |
| `activeTab` | Lets the keyboard shortcut open Aloft over the current page without access to all sites.                                                                    |
| `favicon`   | Shows site icons from the browser's own icon cache, so no site is contacted for them.                                                                       |
| Host access | Optional, asked for once on the first-run page. Only used so Ctrl+T, which isn't a gesture that grants `activeTab`, can open the bar over the current page. |

**Remote code:** No, I am not using remote code. Everything Aloft runs is in the package.

**Data usage:** tick none of the data types. Aloft reads browsing history and tabs only on the device and never transmits them, which the store doesn't count as collecting. Then certify all three statements:

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL:** https://github.com/tomszir/aloft-extension/blob/main/PRIVACY.md

## Distribution

- **Visibility:** Public
- **Regions:** All regions
