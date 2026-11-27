// Serves the web demo's stand-in host page (src/demo/dev) and the built
// bundle, for `pnpm demo:dev` and the demo's end-to-end test.
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const DEV = join(ROOT, 'src/demo/dev')
const BUILT = join(ROOT, '.output/demo/aloft-demo.js')
// The host site's own fonts, for local use only; without them the page falls
// back to system fonts. Not part of this repository.
const FONTS = resolve(ROOT, process.env.ALOFT_DEMO_FONTS ?? '../tomszir.com/src/fonts')
const FONT_FACES = [
  ['Inter Tight', 'inter-tight-latin.woff2', '100 900'],
  ['JetBrains Mono', 'jetbrains-mono-latin.woff2', '100 800'],
] as const

const TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  woff2: 'font/woff2',
}

function fontsCss(): string {
  return FONT_FACES.filter(([, file]) => existsSync(join(FONTS, file)))
    .map(
      ([family, file, weight]) =>
        `@font-face{font-family:"${family}";src:url(/fonts/${file}) format("woff2");font-weight:${weight};font-display:swap}`,
    )
    .join('\n')
}

function fileFor(path: string): string | undefined {
  if (path === '/') return join(DEV, 'index.html')
  if (path === '/dev.js' || path === '/dev.css') return join(DEV, path)
  if (path === '/aloft-demo.js') return BUILT
  const font = FONT_FACES.find(([, file]) => path === `/fonts/${file}`)
  return font ? join(FONTS, font[1]) : undefined
}

export interface DemoServer {
  url: string
  close: () => Promise<void>
}

export async function serveDemo(port = 0): Promise<DemoServer> {
  const server = createServer(async (request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname
    const send = (status: number, type: string, body: string | Buffer) => {
      response.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' })
      response.end(body)
    }
    if (path === '/fonts.css') return send(200, TYPES.css ?? '', fontsCss())
    // Browsers ask for one whatever the page says; an empty answer keeps the log clean.
    if (path === '/favicon.ico') return send(204, 'image/x-icon', '')
    const file = fileFor(path)
    if (!file || !existsSync(file)) return send(404, 'text/plain', 'not found')
    send(
      200,
      TYPES[file.split('.').pop() ?? ''] ?? 'application/octet-stream',
      await readFile(file),
    )
  })
  await new Promise<void>((done) => server.listen(port, '127.0.0.1', done))
  const { port: bound } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${bound}/`,
    close: () => new Promise((done) => server.close(() => done())),
  }
}
