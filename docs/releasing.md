# Releasing

[release-please](https://github.com/googleapis/release-please) keeps a release PR open on `main`, built from the commits since the last release. Merging it tags the version and creates a GitHub release. Then `release.yml`:

1. builds the Chrome and Firefox zips, the sources zip and the web demo, and attaches them to the release (see [Release assets](#release-assets));
2. sets the release's text to that version's notes from `CHANGELOG.md`;
3. calls `publish.yml`, which uploads the same zips to the Chrome Web Store and to addons.mozilla.org (AMO) and submits them for review. Each store publishes its version once review passes.

## Release assets

| File                             | For                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| `aloft-<version>-chrome.zip`     | the Chrome Web Store, uploaded by `publish.yml`                                       |
| `aloft-<version>-firefox.zip`    | addons.mozilla.org, uploaded by `publish.yml`                                         |
| `aloft-<version>-sources.zip`    | addons.mozilla.org's reviewers, who rebuild the Firefox package from it               |
| `aloft-demo-<version>.js`        | the web demo on Aloft's product page ([demo.md](demo.md)), which fetches it from here |
| `aloft-demo-<version>.js.sha256` | its SHA-256, which the product page's build checks the download against               |

## Release notes

`CHANGELOG.md` holds each release's notes for the people using Aloft, newest first. They're written by hand: release-please writes no changelog (`skip-changelog`), and its list of commits only appears in the release PR.

1. **Drafted on the release PR.** Whenever release-please opens or updates the release PR, `release.yml` runs `scripts/release-notes.ts draft`. It adds a section for the new version, `## 0.6.0 — 27 November 2026`, with one line per `feat`, `fix` and `perf` summary since the last release (or a PR's `BEGIN_COMMIT_OVERRIDE` lines), and pushes it to the release PR's branch. A release with none of those gets "Small fixes and improvements."
2. **Rewritten before merging.** Edit the section on the release PR's branch: plain sentences about what someone using Aloft sees or can now do, most noticeable first, and anything that makes them redo something up front. An optional paragraph above the list can sum up a bigger release, and `### ` headings can split its list into groups (a breaking change goes above the first one); the settings page shows them as written. release-please rebuilds its branch whenever `main` moves; the draft keeps the section from the branch's previous head and only adds lines for commits since, so edits survive.
3. **Checked by CI.** A unit test fails while the newest section isn't for `package.json`'s version, so a release PR can't be merged without notes.
4. **Published.** The GitHub release's text is the section plus a link to every commit, and AMO gets the section as the version's release notes. The Chrome Web Store has no field for them.

Aloft shows the notes too. After an update whose notes say more than small fixes, the palette's footer mentions what's new once (it can be switched off), and the settings page lists everything since the version you had. So write them for someone reading them there.

## Screenshots

The store screenshots in `docs/screenshots/` come from `pnpm screenshots`, which runs the real extension in a browser (see `scripts/screenshots.ts`). Whenever the release PR is updated, `release.yml` takes them again from what's about to be released and commits any that look different (`docs: update the store screenshots`), so you can review them in the PR. An image is only rewritten when more than a few pixels change, so rendering noise doesn't count as a change.

When a release's screenshots differ from the previous release's, `publish.yml` replaces AMO's screenshots with them, and leaves a notice on the run. The Chrome Web Store's API can't change a listing's images, so upload them there by hand.

They can also be taken locally with `pnpm screenshots`. A different machine renders text a little differently, so a local run can change every image; the next release PR takes them again either way.

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

`publish.yml`'s `firefox` job runs `scripts/amo.ts`, which uploads the Firefox zip as a listed version, waits for validation, attaches the sources zip, and sets the version's release notes from `CHANGELOG.md`. Running it again for a version AMO already has only resets the notes. Automated review signs and lists the version within minutes to hours; a human review may follow later.

The listing itself (description, categories and so on) is edited by hand from [amo-listing.md](amo-listing.md). AMO's API can't set a version's notes to reviewer, so a new version goes to review without them. If a reviewer asks how to build it, the answer is in amo-listing.md, and also in this file, which is in the sources zip.

The add-on id, `aloft@tomszir` in `wxt.config.ts`, is permanent.

### Setup

Publishing is skipped until this is done. It only has to be done once.

1. **Create API credentials** on AMO under Tools → Manage API Keys. The key is a JWT issuer (`user:…`) and a secret.
2. **Add a GitHub environment** named `firefox`, with a required reviewer if every publish should wait for approval, and give it:

   | Kind     | Name                   | Value           |
   | -------- | ---------------------- | --------------- |
   | Variable | `FIREFOX_EXTENSION_ID` | `aloft@tomszir` |
   | Variable | `FIREFOX_JWT_ISSUER`   | the JWT issuer  |
   | Secret   | `FIREFOX_JWT_SECRET`   | the JWT secret  |

   Also add `FIREFOX_EXTENSION_ID` as a repository variable, for the same reason as `CHROME_EXTENSION_ID`.

3. **Check it:** run `publish.yml` with the latest tag and **dry run** ticked. Tick **screenshots** on a real run to replace AMO's screenshots with the branch's even though they haven't changed since the last release.
