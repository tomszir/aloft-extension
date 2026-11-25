# Releasing

[release-please](https://github.com/googleapis/release-please) keeps a release PR open on `main`, built from the commits since the last release. Merging it tags the version, writes the changelog and creates a GitHub release. Then `release.yml`:

1. builds the Chrome zip and attaches it to the release;
2. calls `publish.yml`, which uploads that same zip to the Chrome Web Store and submits it for review. The store publishes it once review passes.

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
3. **Submit it.** For the first version, choose Submit a New Add-on; for later ones, Upload New Version on the add-on's page. Then follow [amo-listing.md](amo-listing.md): the Firefox zip, Firefox only, yes to source code with the sources zip, and the listing and notes to reviewer.
4. **Wait for review.** Automated review signs and lists the version within minutes to hours; a human review may follow later.

The add-on id, `aloft@tomszir` in `wxt.config.ts`, is permanent once the first version is on AMO.

To automate it later: create API credentials under Tools → Manage API Keys, add them to a `firefox` GitHub environment as `FIREFOX_JWT_ISSUER` (variable) and `FIREFOX_JWT_SECRET` (secret), and pass `--firefox-zip` and `--firefox-sources-zip` to `wxt submit` in `publish.yml`.
