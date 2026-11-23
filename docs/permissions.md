# Permissions

Every permission Aloft asks for and what it's used for. This list also goes into the Chrome Web Store's privacy form; keep it in sync with `wxt.config.ts`.

| Permission              | Why                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `tabs`                  | Read tab titles and addresses to search open tabs and show pinned tabs.                       |
| `history`               | Search your history.                                                                          |
| `bookmarks`             | Search your bookmarks.                                                                        |
| `sessions`              | List and reopen recently closed tabs.                                                         |
| `search`                | Send what you typed to your default search engine when you choose "Search the web".           |
| `storage`               | Save your settings and themes.                                                                |
| `scripting`             | Add the frame that shows the command bar to the page you're on.                               |
| `activeTab`             | Lets the keyboard shortcut (Alt+Q) open Aloft without access to all sites.                    |
| `favicon`               | Show site icons from the browser's own icon cache, so no icon is ever fetched from a site.    |
| `<all_urls>` (optional) | Asked for on the first-run page, only if you want Ctrl+T to open Aloft over the current page. |

## What Aloft doesn't do

- It makes no network requests of its own.
- It collects nothing and has no analytics.
- It never puts your tabs, history or bookmarks into a web page: the command bar runs in an extension frame the page can't read.
