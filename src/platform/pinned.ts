import { browser } from 'wxt/browser'

export async function movePinned(tabId: number, index: number): Promise<void> {
  await browser.tabs.move(tabId, { index })
}

export async function unpin(tabId: number): Promise<void> {
  await browser.tabs.update(tabId, { pinned: false })
}
