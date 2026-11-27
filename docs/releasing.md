# Releasing

[release-please](https://github.com/googleapis/release-please) keeps a release PR open on `main`, built from the commits since the last release. Merging it tags the version and creates a GitHub release. Then `release.yml`:

1. builds the Chrome zip and attaches it to the release;
2. sets the release's text to that version's notes from `CHANGELOG.md`;
3. calls `publish.yml`, which uploads that same zip to the Chrome Web Store and submits it for review. The store publishes it once review passes.

## Release notes

`CHANGELOG.md` holds each release's notes for the people using Aloft, newest first. They're written by hand: release-please writes no changelog (`skip-changelog`), and its list of commits only appears in the release PR.

1. **Drafted on the release PR.** Whenever release-please opens or updates the release PR, `release.yml` runs `scripts/release-notes.ts draft`. It adds a section for the new version, `## 0.6.0 — 27 November 2026`, with one line per `feat`, `fix` and `perf` summary since the last release (or a PR's `BEGIN_COMMIT_OVERRIDE` lines), and pushes it to the release PR's branch. A release with none of those gets "Small fixes and improvements."
2. **Rewritten before merging.** Edit the section on the release PR's branch: plain sentences about what someone using Aloft sees or can now do, most noticeable first, and anything that makes them redo something up front. An optional paragraph above the list can sum up a bigger release. release-please rebuilds its branch whenever `main` moves; the draft keeps the section from the branch's previous head and only adds lines for commits since, so edits survive.
3. **Checked by CI.** A unit test fails while the newest section isn't for `package.json`'s version, so a release PR can't be merged without notes.
4. **Published.** The GitHub release's text is the section plus a link to every commit. For addons.mozilla.org, paste the same section into the version's release notes. The Chrome Web Store has no field for them.

Aloft shows the notes too. After an update whose notes say more than small fixes, the palette's footer mentions what's new once (it can be switched off), and the settings page lists everything since the version you had. So write them for someone reading them there.

To release a particular version instead of the one the commits imply (1.0.0, say), set `"release-as"` for the package in `release-please-config.json` in a `chore` PR. Once that version is out, `release.yml` opens a PR that removes the pin again; merge it, or the next release PR asks for the same version and fails.

`publish.yml` can also be run by hand from the Actions tab for any release tag, for example to retry after a failed upload. Its **dry run** option only checks the store credentials.

## Chrome Web Store setup

Publishing is skipped until this is done. It only has to be done once.

1. **Submit the first version by hand.** The store API can only update an item that already exists. Create the item in the [developer dashboard](https://chrome.google.com/webstore/devconsole), upload a release zip, fill in the listing and privacy practices from [store-listing.md](store-listing.md), and submit it.
2. **Create a service account.** In a Google Cloud project, enable the Chrome Web Store API, create a service account, and add a JSON key for it.
3. **Give it access to the publisher.** In the developer dashboard, under Account, add the service account's email. A publisher can have only one service account.
4. **Add a GitHub environment** named `chrome-web-store` (Settings → Environments). Add yourself as a required reviewer if every publish should wait for approval. Then give the environment:

   | Kind     | Name                                  | Value                                     |
   | -------- | ------------------------------------- | ----------------------------------------- |
   | Variable | `CHROME_EXTENSION_ID`                 | the item's ID, from its dashboard address |
   | Variable | `CHROME_PUBLISHER_ID`                 | from Publisher → Settings                 |
   | Variable | `CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL` | `client_email` from the JSON key          |
   | Secret   | `CHROME_SERVICE_ACCOUNT_PRIVATE_KEY`  | `private_key` from the JSON key           |

   Also add `CHROME_EXTENSION_ID` as a repository variable (Settings → Secrets and variables → Actions → Variables). The job's `if:` decides whether to run before the environment is loaded, so it only sees repository variables. The ID is public anyway: it's in the store address.

   Store `private_key` with real line breaks, not the `\n` escapes from the JSON file, or signing fails with `ERR_OSSL_UNSUPPORTED`: `jq -r .private_key key.json | gh secret set CHROME_SERVICE_ACCOUNT_PRIVATE_KEY -e chrome-web-store`.

5. **Check it:** run `publish.yml` with the latest tag and **dry run** ticked.

## addons.mozilla.org

Each release also carries `aloft-<version>-firefox.zip` and `aloft-<version>-sources.zip`. The sources zip is what AMO's reviewers rebuild the package from: `pnpm install --frozen-lockfile && pnpm zip:firefox` on it gives the same package.

Publishing to AMO isn't automated yet, so every version is submitted by hand:

1. **Once: set up the developer account.** Sign in to the [Developer Hub](https://addons.mozilla.org/developers/) with a Mozilla account, accept the distribution agreement, and set a display name for the developer profile.
2. **Download both zips** from the GitHub release for the version.
3. **Submit it.** For the first version, choose Submit a New Add-on; for later ones, Upload New Version on the add-on's page. Then follow [amo-listing.md](amo-listing.md): the Firefox zip, Firefox only, yes to source code with the sources zip, and the listing and notes to reviewer. Paste the version's section from `CHANGELOG.md` as its release notes.
4. **Wait for review.** Automated review signs and lists the version within minutes to hours; a human review may follow later.

The add-on id, `aloft@tomszir` in `wxt.config.ts`, is permanent once the first version is on AMO.

To automate it later: create API credentials under Tools → Manage API Keys, add them to a `firefox` GitHub environment as `FIREFOX_JWT_ISSUER` (variable) and `FIREFOX_JWT_SECRET` (secret), and pass `--firefox-zip` and `--firefox-sources-zip` to `wxt submit` in `publish.yml`.
