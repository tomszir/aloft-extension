import { cleanup } from '@solidjs/testing-library'
import { afterEach, beforeAll } from 'vitest'

// The demo runs on an ordinary web page: any reach for an extension API is a
// bug, so it fails the test instead of finding a fake.
beforeAll(() => {
  for (const name of ['browser', 'chrome']) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      get() {
        throw new Error(`the web demo touched ${name}.*`)
      },
    })
  }
})

afterEach(cleanup)
