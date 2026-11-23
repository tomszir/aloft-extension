// Copies the icons listed in vendor/icons.lock.json into src/ui/icon/svg/ from
// the pinned npm package. The tarball's sha512 must match the lock, so a
// re-vendor can't silently pull in different artwork. Review the diff like any
// other.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const lock = JSON.parse(readFileSync(join(ROOT, 'vendor', 'icons.lock.json'), 'utf8'))
const source = lock.sources.lucide
const out = join(ROOT, 'src', 'ui', 'icon', 'svg')
const scratch = mkdtempSync(join(tmpdir(), 'aloft-icons-'))

// One shape for every icon (24 px viewBox, stroked in currentColor), so the
// Icon component can render the shapes itself and check nothing else slipped in.
function normalise(svg) {
  const body = svg
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<title>[\s\S]*?<\/title>/g, '')
    .replace(/<svg\b[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/\s*\n\s*/g, '')
    .trim()
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>\n`
}

try {
  execFileSync(
    'npm',
    ['pack', `${source.package}@${source.version}`, '--pack-destination', scratch, '--silent'],
    { stdio: ['ignore', 'pipe', 'inherit'] },
  )
  const tarball = join(
    scratch,
    readdirSync(scratch).find((name) => name.endsWith('.tgz')),
  )
  const integrity = `sha512-${createHash('sha512').update(readFileSync(tarball)).digest('base64')}`
  if (integrity !== source.integrity) {
    throw new Error(
      `${source.package}@${source.version}: integrity ${integrity} does not match the lock`,
    )
  }
  execFileSync('tar', ['xzf', tarball, '-C', scratch])
  const pkg = join(scratch, 'package')

  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  writeFileSync(join(out, 'LICENSE.txt'), readFileSync(join(pkg, source.license), 'utf8'))
  for (const name of lock.icons) {
    const svg = readFileSync(join(pkg, source.path.replace('{icon}', name)), 'utf8')
    writeFileSync(join(out, `${name}.svg`), normalise(svg))
    console.log(`vendored ${name} (${source.package} ${source.version})`)
  }
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
