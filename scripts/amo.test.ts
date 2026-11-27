import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { token } from './amo.ts'

describe('token', () => {
  it('signs a short-lived token for the key', () => {
    const now = Date.UTC(2026, 10, 27)
    const [head, body, signature] = token('user:1:2', 'secret', now).split('.')
    const decode = (part = '') => JSON.parse(Buffer.from(part, 'base64url').toString())
    expect(decode(head)).toEqual({ alg: 'HS256', typ: 'JWT' })
    const claims = decode(body)
    expect(claims).toMatchObject({ iss: 'user:1:2', iat: now / 1000, exp: now / 1000 + 60 })
    expect(claims.jti).toEqual(expect.any(String))
    expect(signature).toBe(
      createHmac('sha256', 'secret').update(`${head}.${body}`).digest('base64url'),
    )
  })

  it('never repeats', () => {
    expect(token('i', 's', 0)).not.toBe(token('i', 's', 0))
  })
})
