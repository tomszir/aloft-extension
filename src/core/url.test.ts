import { describe, expect, it } from 'vitest'
import { navigableUrl } from './url'

describe('navigableUrl', () => {
  it("opens Helium's own pages under the scheme every Chromium browser navigates to", () => {
    expect(navigableUrl('helium://settings/')).toBe('chrome://settings/')
    expect(navigableUrl('HELIUM://extensions/')).toBe('chrome://extensions/')
  })

  it('leaves every other address alone', () => {
    expect(navigableUrl('chrome://settings/')).toBe('chrome://settings/')
    expect(navigableUrl('https://example.com/helium://x')).toBe('https://example.com/helium://x')
  })
})
