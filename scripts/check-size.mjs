// Enforces the bundle budgets from docs/architecture.md. Run after `pnpm build`.
// The overlay script is injected into every page Aloft opens on, and the
// palette has to appear instantly, so both are kept small on purpose.
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const OUT = new URL('../.output/chrome-mv3/', import.meta.url).pathname

const gzipKb = async (file) => gzipSync(await readFile(join(OUT, file)), { level: 9 }).length / 1024

// Static imports only: dynamic chunks don't block the first paint.
async function scriptsOf(html) {
  const source = await readFile(join(OUT, html), 'utf8')
  const seen = new Set()
  const queue = [...source.matchAll(/<script[^>]+src="\/([^"]+\.js)"/g)].map((m) => m[1])
  while (queue.length > 0) {
    const file = queue.pop()
    if (seen.has(file)) continue
    seen.add(file)
    const js = await readFile(join(OUT, file), 'utf8')
    for (const m of js.matchAll(
      /(?:^|[;\n}])\s*import\s*(?:[^'"()]*?from\s*)?["']\/?([^"']+\.js)["']/g,
    )) {
      queue.push(m[1].startsWith('chunks/') ? m[1] : join(file, '..', m[1]))
    }
  }
  return [...seen]
}

const budgets = [
  { name: 'overlay content script', files: ['content-scripts/overlay.js'], kb: 5 },
  { name: 'palette page', files: await scriptsOf('palette.html'), kb: 40 },
]

let failed = false
for (const budget of budgets) {
  const sizes = await Promise.all(budget.files.map(gzipKb))
  const total = sizes.reduce((a, b) => a + b, 0)
  const ok = total <= budget.kb
  failed ||= !ok
  console.log(
    `${ok ? '✓' : '✗'} ${budget.name}: ${total.toFixed(1)} KB gzipped (budget ${budget.kb} KB)`,
  )
}

const unexpected = (await readdir(join(OUT, 'content-scripts'))).filter((f) => f !== 'overlay.js')
if (unexpected.length > 0)
  console.log(`  note: unbudgeted content scripts: ${unexpected.join(', ')}`)

process.exit(failed ? 1 : 0)
