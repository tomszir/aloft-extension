// Enforces the bundle budgets from docs/architecture.md and docs/demo.md for
// everything that has been built. Run after `pnpm build` (and `pnpm
// build:firefox`, `pnpm demo:build`).
// The overlay script is injected into every page Aloft opens on, and the
// palette has to appear instantly, so both are kept small on purpose.
import { access, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const OUTPUT = new URL('../.output/', import.meta.url).pathname
const TARGETS = ['chrome-mv3', 'firefox-mv3']

const gzipKb = async (out, file) =>
  gzipSync(await readFile(join(out, file)), { level: 9 }).length / 1024

// Static imports only: dynamic chunks don't block the first paint.
async function scriptsOf(out, html) {
  const source = await readFile(join(out, html), 'utf8')
  const seen = new Set()
  const queue = [...source.matchAll(/<script[^>]+src="\/([^"]+\.js)"/g)].map((m) => m[1])
  while (queue.length > 0) {
    const file = queue.pop()
    if (seen.has(file)) continue
    seen.add(file)
    const js = await readFile(join(out, file), 'utf8')
    for (const m of js.matchAll(
      /(?:^|[;\n}])\s*import\s*(?:[^'"()]*?from\s*)?["']\/?([^"']+\.js)["']/g,
    )) {
      queue.push(m[1].startsWith('chunks/') ? m[1] : join(file, '..', m[1]))
    }
  }
  return [...seen]
}

let failed = false
let checked = 0
for (const target of TARGETS) {
  const out = join(OUTPUT, target)
  try {
    await access(out)
  } catch {
    continue
  }
  checked++
  console.log(target)
  const budgets = [
    { name: 'overlay content script', files: ['content-scripts/overlay.js'], kb: 5 },
    { name: 'palette page', files: await scriptsOf(out, 'palette.html'), kb: 42 },
  ]

  for (const budget of budgets) {
    const sizes = await Promise.all(budget.files.map((file) => gzipKb(out, file)))
    const total = sizes.reduce((a, b) => a + b, 0)
    const ok = total <= budget.kb
    failed ||= !ok
    console.log(
      `${ok ? '✓' : '✗'} ${budget.name}: ${total.toFixed(1)} KB gzipped (budget ${budget.kb} KB)`,
    )
  }

  const unexpected = (await readdir(join(out, 'content-scripts'))).filter((f) => f !== 'overlay.js')
  if (unexpected.length > 0)
    console.log(`  note: unbudgeted content scripts: ${unexpected.join(', ')}`)
}

// The web demo is one file with its styles and strings inside, loaded only
// when a visitor asks for it, so it gets a little more than the palette page.
const DEMO = { file: 'demo/aloft-demo.js', kb: 46 }
const demoBuilt = await access(join(OUTPUT, DEMO.file)).then(
  () => true,
  () => false,
)
if (demoBuilt) {
  checked++
  console.log('demo')
  const size = await gzipKb(OUTPUT, DEMO.file)
  const ok = size <= DEMO.kb
  failed ||= !ok
  console.log(`${ok ? '✓' : '✗'} web demo: ${size.toFixed(1)} KB gzipped (budget ${DEMO.kb} KB)`)
}

if (checked === 0) {
  console.log('nothing built: run pnpm build or pnpm demo:build first')
  failed = true
}
process.exit(failed ? 1 : 0)
