// @vitest-environment node
import { createServer, type IncomingMessage } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, expect, test, vi } from 'vitest'
import handler, { vercelClientAddress, vercelConfiguration } from './vercel.js'

const environment = {
  VERCEL: '1', VERCEL_ENV: 'production', NODEJS_HELPERS: '0',
  APP_ORIGIN: 'https://sqlflashcards.example',
  DATABASE_URL: 'postgresql://unused.example/test',
  SQLFLASHCARDS_PIN_PEPPER: 'test-only-pepper-with-more-than-32-characters',
}
afterEach(() => { vi.unstubAllEnvs() })

test('requires an explicit HTTPS production origin, database, pepper, and raw request handling', () => {
  expect(vercelConfiguration(environment).origin).toBe(environment.APP_ORIGIN)
  for (const change of [
    { VERCEL: '0' }, { VERCEL_ENV: 'preview' }, { VERCEL_ENV: 'development' },
    { APP_ORIGIN: 'http://sqlflashcards.example' }, { APP_ORIGIN: 'https://sqlflashcards.example/path' },
    { APP_ORIGIN: 'https://user:password@sqlflashcards.example' },
    { DATABASE_URL: '' }, { SQLFLASHCARDS_PIN_PEPPER: 'short' }, { NODEJS_HELPERS: '1' },
  ]) expect(() => vercelConfiguration({ ...environment, ...change })).toThrow()
})

test('uses only a valid Vercel edge client address, ignoring attacker forwarding chains', () => {
  const request = (headers: IncomingMessage['headers']) => ({ headers }) as IncomingMessage
  expect(vercelClientAddress(request({ 'x-vercel-forwarded-for': '192.0.2.10', 'x-forwarded-for': 'attacker' }))).toBe('192.0.2.10')
  expect(vercelClientAddress(request({ 'x-vercel-forwarded-for': '::ffff:192.0.2.10' }))).toBe('192.0.2.10')
  expect(vercelClientAddress(request({ 'x-vercel-forwarded-for': '2001:db8::1' }))).toBe('2001:db8::1')
  for (const headers of [{}, { 'x-forwarded-for': '192.0.2.10' }, { 'x-vercel-forwarded-for': '192.0.2.10, 192.0.2.11' }, { 'x-vercel-forwarded-for': ['192.0.2.10'] }]) {
    expect(vercelClientAddress(request(headers))).toBe('unknown-vercel-client')
  }
})

test('an unconfigured hosted API returns a retryable error without exposing secrets', async () => {
  vi.stubEnv('VERCEL', '0')
  vi.stubEnv('DATABASE_URL', 'postgresql://private-user:private-password@secret-host/database')
  const server = createServer((request, response) => { void handler(request, response) })
  await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', resolve) })
  try {
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/session`
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(url)
      expect(response.status).toBe(503)
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(response.headers.get('retry-after')).toBe('30')
      expect(await response.json()).toEqual({ error: { code: 'service_unavailable', message: 'The account service is unavailable. Please try again shortly.' } })
    }
  } finally { await new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()) }) }
})
