# Contributing

Thanks for helping. A few rules keep the history and changelog clean.

## Setup

Install [mise](https://mise.jdx.dev), then:

```sh
mise run setup   # dependencies and git hooks
mise run dev     # a browser with Aloft loaded and live reload
```

Before opening a PR, run `mise run check`, `pnpm test`, `pnpm build && pnpm size` and `pnpm test:e2e`. The `pre-push` hook runs the end-to-end tests, since CI doesn't require them.

## Commits and PRs

- **Conventional Commits:** `type(scope): summary`, for example `fix(actions): keep focus after closing the menu`.
  - Types: `feat` `fix` `perf` `refactor` `docs` `test` `build` `ci` `chore` `revert`.
  - The summary is imperative, lowercase, at most 72 characters, with no trailing period.
  - `feat`, `fix` and `perf` commits go into the changelog, so write them for users: what they'll notice, not how it was done. Scope them by area (`search`, `actions`, `pinned`, `overlay`, `onboarding`, `settings`, `theme`) when one fits.
  - Mark breaking changes with `type!:` or a `BREAKING CHANGE:` footer, including anything that makes a user redo something: settings that don't carry over, a changed shortcut or keyword, or a theme that stops loading.
- **Lean messages:** add a body only when the reason isn't obvious from the summary.
- **One topic per PR.** PRs are squash-merged, so the **PR title becomes the commit**: make it a conventional commit. Keep the description to a line or two on what and why, plus how you tested it.
- **No AI attribution** lines (`Co-Authored-By` bots, "Generated with …") in commits or PRs.

The `commit-msg` git hook and the `pr-title` CI check enforce the format.

## Code

See [AGENTS.md](AGENTS.md) for the code conventions (layers, components, styling, tests) and [docs/architecture.md](docs/architecture.md) for how Aloft works.

By contributing, you agree that your work is licensed under the project's [GPL-3.0-only](LICENSE) license.
