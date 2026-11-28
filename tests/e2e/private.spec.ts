import { allowInPrivate, expect, pressOpenAloft, TEST_ORIGIN, test } from './fixtures'

const page = (title: string) => `data:text/html,<title>${title}</title>`

test("a normal window lists neither a private window's tabs nor the ones closed there", async ({
  context,
  background,
}) => {
  const worker = await allowInPrivate(context, background)
  await worker.evaluate(
    async ([open, closing]) => {
      type Tab = { id?: number; status?: string }
      const api = Reflect.get(globalThis, 'chrome') as {
        windows: { create: (props: object) => Promise<{ id?: number }> }
        tabs: {
          create: (props: object) => Promise<Tab>
          get: (id: number) => Promise<Tab>
          remove: (id: number) => Promise<void>
        }
      }
      const window = await api.windows.create({ incognito: true, url: open })
      const tab = await api.tabs.create({ windowId: window.id, url: closing })
      if (tab.id === undefined) throw new Error('no private tab')
      // Only a page that loaded is kept to reopen.
      while ((await api.tabs.get(tab.id)).status !== 'complete')
        await new Promise((done) => setTimeout(done, 20))
      await api.tabs.remove(tab.id)
    },
    [page('Private open'), page('Private closed')],
  )
  await (await context.newPage()).goto(`${TEST_ORIGIN}/Normal open`)
  const other = await context.newPage()
  await other.goto(`${TEST_ORIGIN}/Normal closed`)
  await other.close()
  const normal = await context.newPage()
  await normal.goto(`${TEST_ORIGIN}/`)

  await pressOpenAloft(worker, normal)
  const palette = normal.locator('iframe[title="Aloft"]').contentFrame()
  await expect(palette.getByRole('option', { name: /Normal closed/ })).toBeVisible()
  await expect(palette.getByRole('option', { name: /Private/ })).toHaveCount(0)

  await palette.getByRole('combobox').fill('open')
  await expect(palette.getByRole('option', { name: /Normal open/ })).toBeVisible()
  await expect(palette.getByRole('option', { name: /Private/ })).toHaveCount(0)
})
