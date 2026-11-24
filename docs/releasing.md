# Releasing

[release-please](https://github.com/googleapis/release-please) keeps a release PR open on `main`, built from the commits since the last release. Merging it tags the version, writes the changelog and creates a GitHub release. Then `release.yml`:

1. builds the Chrome zip and attaches it to the release;
2. calls `publish.yml`, which uploads that same zip to the Chrome Web Store and submits it for review. The store publishes it once review passes.

`publish.yml` can also be run by hand from the Actions tab for any release tag, for example to retry after a failed upload. Its **dry run** option only checks the store credentials.

## Chrome Web Store setup

Publishing is skipped until this is done. It only has to be done once.

1. **Submit the first version by hand.** The store API can only update an item that already exists. Create the item in the [developer dashboard](https://chrome.google.com/webstore/devconsole), upload a release zip, fill in the listing and privacy practices, and submit it.
2. **Create a service account.** In a Google Cloud project, enable the Chrome Web Store API, create a service account, and add a JSON key for it.
3. **Give it access to the publisher.** In the developer dashboard, under Account, add the service account's email.
4. **Add a GitHub environment** named `chrome-web-store` (Settings → Environments). Add yourself as a required reviewer if every publish should wait for approval. Then give the environment:

   | Kind     | Name                                  | Value                                     |
   | -------- | ------------------------------------- | ----------------------------------------- |
   | Variable | `CHROME_EXTENSION_ID`                 | the item's ID, from its dashboard address |
   | Variable | `CHROME_PUBLISHER_ID`                 | the publisher ID, from Account            |
   | Variable | `CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL` | `client_email` from the JSON key          |
   | Secret   | `CHROME_SERVICE_ACCOUNT_PRIVATE_KEY`  | `private_key` from the JSON key           |

5. **Check it:** run `publish.yml` with the latest tag and **dry run** ticked.
