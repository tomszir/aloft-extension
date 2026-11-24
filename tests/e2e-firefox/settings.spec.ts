import { expect, tabUrls, test } from './fixtures'

test("Change shortcut opens Firefox's shortcut settings", async ({ control }) => {
  // The control page is Aloft's settings page.
  await control.locator('button ::-p-text(Change shortcut)').click()

  await expect
    .poll(async () => (await tabUrls(control)).some((url) => url.startsWith('about:addons')))
    .toBe(true)
})
