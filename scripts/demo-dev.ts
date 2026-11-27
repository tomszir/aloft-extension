// `pnpm demo:dev`: rebuilds the web demo on every change and serves it on a
// page with the host site's CSP. Reload the page to see a change.
import { build } from 'vite'
import { serveDemo } from './demo-server.ts'

await build({ configFile: 'vite.demo.config.ts', build: { watch: {} }, logLevel: 'warn' })
const { url } = await serveDemo(Number(process.env.PORT ?? 4178))
console.log(`Aloft demo: ${url}`)
