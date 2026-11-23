# Aloft

A Manifest V3 extension (WXT, Solid, TypeScript) that opens a floating command bar over the current page with Ctrl+T or Alt+Q. How it fits together: [docs/architecture.md](docs/architecture.md).

The repository is public: nothing private goes in it (personal notes, plans, links only the maintainer can open, local paths, credentials).

## Commands

| Task                            | Command                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| Install deps and git hooks      | `mise run setup`                                                                            |
| Lint and typecheck              | `mise run check`                                                                            |
| Unit tests                      | `pnpm test`                                                                                 |
| Build and size budgets          | `pnpm build && pnpm size`                                                                   |
| End-to-end tests                | `pnpm test:e2e` (Playwright's Chromium; `ALOFT_BROWSER=/usr/bin/helium-browser` for Helium) |
| Store screenshots               | `pnpm screenshots`                                                                          |
| Re-vendor icons from their lock | `mise run icons:vendor`                                                                     |

Run all of the first four before opening a PR. The `pre-push` hook runs the end-to-end tests; CI runs them too but doesn't require them.

## Git

- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org): `type(scope): summary`.
  - Types: `feat` `fix` `perf` `refactor` `docs` `test` `build` `ci` `chore` `revert`.
  - The summary is imperative, lowercase, at most 72 characters, no trailing period.
  - Add a body only when the why isn't obvious: a few short lines, no list of changed files.
  - Breaking changes: `type!:` or a `BREAKING CHANGE:` footer.
- **No AI attribution**, anywhere: no `Co-Authored-By` trailers, no "Generated with/by" lines, no emoji signatures in commits, PR titles or PR bodies. The `commit-msg` hook and the `pr-title` CI job reject them.
- **PRs**: one topic each, on a branch named `type/short-topic`.
  - The title is a conventional commit; PRs are squash-merged, so it becomes the commit on main.
  - The body is 1–3 lines: what changed and why, and how it was tested. No checklists.
- **Merging**: agents may squash-merge `docs`, `build`, `ci`, `chore` and `test` PRs once CI is green. `feat`, `fix`, `perf`, `refactor`, `revert` and release PRs wait for the maintainer. Never push to `main` directly or use the admin bypass.
- **Releases** are cut by release-please from the commits on `main`; never edit `CHANGELOG.md` or the version by hand.

## Code

- **Layers** (enforced by Biome, see `biome.json`):
  - `core/` is plain TypeScript: no browser APIs, no Solid, no WXT.
  - `platform/` is the only layer that calls `chrome.*`/`browser.*`.
  - `ui/` holds Solid components. `app/` holds Solid glue shared by entrypoints.
  - `entrypoints/` only wires things together.
- **UI**: one folder per component: `ui/<name>/<name>.tsx`, `<name>.module.css`, `<name>.test.tsx`. Files and CSS classes are kebab-case. Component CSS uses only `--al-*` tokens from `ui/tokens.css` or the theme, never raw colors or sizes.
- **Strings** go through `src/locales/en.yml` (`i18n.t`), never literals in components.
- **Browsers**: no browser sniffing. Helium reports itself as Chrome, so everything must work in any Chromium browser. Firefox differences live in `platform/` behind `import.meta.env.FIREFOX`. UI text stays browser-neutral.
- **Privacy**: no network requests, no analytics. The palette renders inside an extension iframe, so pages can't read it. Never put tab, history or bookmark data into a page's DOM.
- **Comments** explain why: constraints, browser quirks, non-obvious decisions. Never restate the code, narrate a change, or add section dividers.
- **Tests**: every behavior change ships with a test at the right level: `core/` unit tests, UI tests with `@solidjs/testing-library`, Playwright for anything that needs a real browser.
- **TypeScript** is strict with `noUncheckedIndexedAccess`. No `any`, no non-null assertions.
- **Vendored icons** come only from `vendor/icons.lock.json` via `mise run icons:vendor`; don't hand-edit `src/ui/icon/svg/`.
