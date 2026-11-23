import { cleanup } from '@solidjs/testing-library'
import { afterEach, beforeEach } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

beforeEach(() => {
  fakeBrowser.reset()
  // fakeBrowser leaves i18n unimplemented. Keys are already type-checked by
  // #i18n, so echoing them is enough for tests that look things up by role.
  fakeBrowser.i18n.getMessage = (key: string) => key
})

// The testing library only cleans up on its own when Vitest globals are on.
afterEach(cleanup)
