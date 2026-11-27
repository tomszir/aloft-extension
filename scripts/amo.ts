// Publishes a release to addons.mozilla.org through its API, from the
// publish workflow (docs/releasing.md). Needs FIREFOX_EXTENSION_ID,
// FIREFOX_JWT_ISSUER and FIREFOX_JWT_SECRET.
//
//   node scripts/amo.ts check
//     Checks the credentials can manage the add-on; uploads nothing.
//
//   node scripts/amo.ts publish <version> <firefox zip> <sources zip>
//     Submits the version with its sources and its notes from CHANGELOG.md.
//     Running it again for a version that's already there only resets the
//     notes, so a failed run can be retried.
//
//   node scripts/amo.ts screenshots
//     Replaces the listing's screenshots with docs/screenshots/<n>-*.png.
import { createHmac, randomUUID } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { amoNotes, CHANGELOG, sectionBody } from './release-notes.ts'

const API = 'https://addons.mozilla.org/api/v5'
const SCREENSHOTS = 'docs/screenshots'

/** A signed token for one request: AMO allows at most five minutes. */
export function token(issuer: string, secret: string, now = Date.now()): string {
  const iat = Math.floor(now / 1000)
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const unsigned = `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ iss: issuer, jti: randomUUID(), iat, exp: iat + 60 })}`
  return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`
}

function env(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} isn't set`)
  return value
}

class AmoError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function api<T>(method: string, path: string, body?: FormData | object): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `JWT ${token(env('FIREFOX_JWT_ISSUER'), env('FIREFOX_JWT_SECRET'))}`,
  }
  let payload: FormData | string | undefined
  if (body instanceof FormData) payload = body
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  const response = await fetch(`${API}${path}`, { method, headers, body: payload })
  const text = await response.text()
  if (!response.ok) {
    throw new AmoError(
      response.status,
      `${method} ${path}: ${response.status} ${text.slice(0, 2000)}`,
    )
  }
  return (text ? JSON.parse(text) : undefined) as T
}

const addon = () => `/addons/addon/${encodeURIComponent(env('FIREFOX_EXTENSION_ID'))}`

async function file(path: string): Promise<Blob> {
  return new Blob([await readFile(path)])
}

interface Upload {
  uuid: string
  processed: boolean
  valid: boolean
  validation: { messages?: { type: string; message: string }[] } | null
}

async function upload(zip: string): Promise<string> {
  const form = new FormData()
  form.append('upload', await file(zip), basename(zip))
  form.append('channel', 'listed')
  let status = await api<Upload>('POST', '/addons/upload/', form)
  const deadline = Date.now() + 10 * 60_000
  while (!status.processed) {
    if (Date.now() > deadline) throw new Error(`upload ${status.uuid} wasn't validated in time`)
    await new Promise((resolve) => setTimeout(resolve, 5000))
    status = await api<Upload>('GET', `/addons/upload/${status.uuid}/`)
  }
  for (const { type, message } of status.validation?.messages ?? []) {
    console.log(`${type}: ${message.replace(/<[^>]+>/g, '')}`)
  }
  if (!status.valid) throw new Error('addons.mozilla.org rejected the package; see above')
  return status.uuid
}

async function exists(version: string): Promise<boolean> {
  try {
    await api('GET', `${addon()}/versions/v${version}/`)
    return true
  } catch (error) {
    if (error instanceof AmoError && error.status === 404) return false
    throw error
  }
}

async function publish(version: string, zip: string, sources: string) {
  const notes = sectionBody(await readFile(CHANGELOG, 'utf8'), version)
  if (!notes) throw new Error(`${CHANGELOG} has no notes for ${version}`)
  if (await exists(version)) {
    console.log(`${version} is already on addons.mozilla.org; only its notes are set`)
  } else {
    const uuid = await upload(zip)
    // The sources only go up as form data, and the notes only as JSON, so
    // they're two requests.
    const form = new FormData()
    form.append('upload', uuid)
    form.append('source', await file(sources), basename(sources))
    await api('POST', `${addon()}/versions/`, form)
    console.log(`${version} submitted for review`)
  }
  await api('PATCH', `${addon()}/versions/v${version}/`, {
    release_notes: { 'en-US': amoNotes(notes) },
  })
  console.log('release notes set')
}

async function screenshots() {
  const names = (await readdir(SCREENSHOTS)).filter((name) => /^\d+-.+\.png$/.test(name)).sort()
  if (names.length === 0) throw new Error(`no screenshots in ${SCREENSHOTS}`)
  const { previews } = await api<{ previews: { id: number }[] }>('GET', `${addon()}/`)
  // The new ones go up before the old ones come down, so the listing is
  // never left without any.
  for (const [position, name] of names.entries()) {
    const form = new FormData()
    form.append('image', await file(join(SCREENSHOTS, name)), name)
    form.append('position', String(position))
    await api('POST', `${addon()}/previews/`, form)
    console.log(`uploaded ${name}`)
  }
  for (const { id } of previews) await api('DELETE', `${addon()}/previews/${id}/`)
  console.log(`removed ${previews.length} old screenshots`)
}

async function check() {
  // Only the add-on's authors can list all its versions, so this proves the
  // key, not just that the add-on is public.
  await api('GET', `${addon()}/versions/?filter=all_with_unlisted`)
  console.log(`the credentials can manage ${env('FIREFOX_EXTENSION_ID')}`)
}

if (import.meta.main) {
  const [command, ...args] = process.argv.slice(2)
  const [version, zip, sources] = args
  if (command === 'check') await check()
  else if (command === 'publish' && version && zip && sources) await publish(version, zip, sources)
  else if (command === 'screenshots') await screenshots()
  else {
    throw new Error(
      'usage: amo.ts check | publish <version> <firefox zip> <sources zip> | screenshots',
    )
  }
}
