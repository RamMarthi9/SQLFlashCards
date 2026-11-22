// @vitest-environment node
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, isAbsolute } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { createAccountServer, type AccountServerOptions } from './app.js'
import type { Account, Progress } from './accountStore.js'

const origin = 'https://sqlflashcards.example'
const pepper = 'a-test-only-pepper-which-is-not-a-production-secret'
type Running = ReturnType<typeof createAccountServer>
type SessionReply = { account: Account | null }
type ErrorReply = { error: { code: string; message: string } }
type ProgressReply = { accountId: string; progress: Progress[] }
type SaveReply = { kind: 'saved'; progress: Progress } | { kind: 'stale'; current: Progress | null }
let directory: string
let databasePath: string
let api: Running
let url: string
let now: number
const running = new Set<Running>()

async function start(options: Partial<AccountServerOptions> = {}) {
  const app = createAccountServer({ databasePath, pepper, origin, now: () => now, ...options })
  await new Promise<void>((resolveListen, reject) => {
    app.server.once('error', reject)
    app.server.listen(0, '127.0.0.1', () => { app.server.off('error', reject); resolveListen() })
  })
  running.add(app)
  api = app
  url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`
}
async function restart(options: Partial<AccountServerOptions> = {}) {
  await api.close()
  running.delete(api)
  await start(options)
}
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'sqlflashcards-account-test-'))
  databasePath = join(directory, 'accounts.sqlite')
  now = Date.parse('2026-11-22T12:00:00.000Z')
  await start()
})
afterEach(async () => {
  for (const app of running) await app.close()
  running.clear()
  const withinTemporary = relative(tmpdir(), directory)
  if (!withinTemporary.startsWith('sqlflashcards-account-test-') || withinTemporary.includes('..') || isAbsolute(withinTemporary)) throw new Error('Refusing unexpected cleanup path')
  await rm(directory, { recursive: true, force: true })
})

async function call<T = ErrorReply>(method: string, path: string, body?: unknown, cookie?: string, accountId?: string, headers: Record<string, string> = {}) {
  const response = await fetch(`${url}${path}`, {
    method,
    headers: { ...(method === 'GET' ? {} : { Origin: origin, 'Content-Type': 'application/json', 'X-SQLFlashCards-Request': '1' }), ...(cookie ? { Cookie: cookie } : {}), ...(accountId ? { 'X-Account-ID': accountId } : {}), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const data: unknown = await response.json()
  return { response, data: data as T }
}
async function signup(name = 'Alice', pin = '0123') {
  const { response, data } = await call<SessionReply>('POST', '/api/signup', { name, pin })
  expect(response.status).toBe(200)
  const cookie = response.headers.get('set-cookie')?.split(';')[0]
  if (!cookie || !data.account) throw new Error('Signup did not create an account session')
  return { account: data.account, cookie, setCookie: response.headers.get('set-cookie')! }
}

test('keeps each account’s completion separate and restores it after server restart and a new sign-in', async () => {
  const alice = await signup()
  const bob = await signup('Bob', '9876')
  const saved = await call<SaveReply>('PUT', '/api/progress/basic-queries', { covered: true, expectedVersion: 0 }, alice.cookie, alice.account.id)
  expect(saved.data).toEqual({ kind: 'saved', progress: { topicId: 'basic-queries', covered: true, coveredAt: '2026-11-22T12:00:00.000Z', updatedAt: '2026-11-22T12:00:00.000Z', version: 1 } })
  expect((await call<ProgressReply>('GET', '/api/progress', undefined, bob.cookie, bob.account.id)).data.progress).toEqual([])
  await restart()
  const login = await call<SessionReply>('POST', '/api/login', { name: ' ALICE ', pin: '0123' })
  expect(login.data.account).toEqual(alice.account)
  const newCookie = login.response.headers.get('set-cookie')!.split(';')[0]!
  expect((await call<ProgressReply>('GET', '/api/progress', undefined, newCookie, alice.account.id)).data.progress).toEqual([expect.objectContaining({ topicId: 'basic-queries', covered: true, version: 1 })])
  await call('PUT', '/api/progress/basic-queries', { covered: false, expectedVersion: 1 }, newCookie, alice.account.id)
  await restart()
  expect((await call<ProgressReply>('GET', '/api/progress', undefined, newCookie, alice.account.id)).data.progress).toEqual([expect.objectContaining({ covered: false, coveredAt: null, version: 2 })])
}, 15_000)

test('authenticates every progress request and rejects another account ID or a stale tab owner', async () => {
  const alice = await signup()
  const bob = await signup('Bob')
  expect((await call('GET', '/api/progress', undefined, undefined, alice.account.id)).response.status).toBe(401)
  expect((await call('PUT', '/api/progress/basic-queries', { covered: true, expectedVersion: 0 }, undefined, alice.account.id)).response.status).toBe(401)
  expect((await call('GET', '/api/progress', undefined, bob.cookie, alice.account.id)).data.error.code).toBe('account_changed')
  expect((await call('PUT', '/api/progress/basic-queries', { covered: true, expectedVersion: 0, accountId: alice.account.id }, bob.cookie, alice.account.id)).response.status).toBe(409)
  expect((await call('GET', '/api/progress', undefined, alice.cookie)).response.status).toBe(409)
  expect((await call<ProgressReply>('GET', '/api/progress', undefined, alice.cookie, alice.account.id)).data.progress).toEqual([])
  expect((await call<ProgressReply>('GET', '/api/progress', undefined, bob.cookie, bob.account.id)).data.progress).toEqual([])
})

test('rejects cross-site or unverified writes including login and logout, without CORS', async () => {
  const blocked = await call('POST', '/api/signup', { name: 'Alice', pin: '0123' }, undefined, undefined, { Origin: 'https://attacker.example' })
  expect(blocked.response.status).toBe(403)
  expect(blocked.response.headers.get('access-control-allow-origin')).toBeNull()
  const alice = await signup()
  expect((await call('POST', '/api/login', { name: 'Alice', pin: '0123' }, undefined, undefined, { 'X-SQLFlashCards-Request': '' })).response.status).toBe(403)
  expect((await call('PUT', '/api/progress/basic-queries', { covered: true, expectedVersion: 0 }, alice.cookie, alice.account.id, { 'Content-Type': 'text/plain' })).response.status).toBe(403)
  expect((await call('POST', '/api/logout', {}, alice.cookie, alice.account.id, { Origin: '' })).response.status).toBe(403)
  expect((await call<SessionReply>('GET', '/api/session', undefined, alice.cookie)).data.account).toEqual(alice.account)
})

test('stores salted PIN hashes and session token hashes, sets protected cookies, and revokes logout', async () => {
  await restart({ secureCookies: true })
  const alice = await signup()
  const bob = await signup('Bob')
  expect(alice.setCookie).toContain('HttpOnly')
  expect(alice.setCookie).toContain('SameSite=Strict')
  expect(alice.setCookie).toContain('Secure')
  const db = new DatabaseSync(databasePath)
  try {
    const rows = db.prepare('SELECT pin_salt, pin_hash FROM accounts ORDER BY name').all()
    expect(rows).toHaveLength(2)
    expect(rows[0]?.pin_salt).not.toBe(rows[1]?.pin_salt)
    expect(rows[0]?.pin_hash).not.toBe(rows[1]?.pin_hash)
    expect(String(rows[0]?.pin_hash)).toHaveLength(128)
    const tokens = db.prepare('SELECT token_hash FROM sessions').all()
    expect(tokens.every((row) => typeof row.token_hash === 'string' && row.token_hash.length === 64)).toBe(true)
    expect(tokens.map((row) => row.token_hash)).not.toContain(alice.cookie.split('=')[1])
  } finally { db.close() }
  expect((await call('POST', '/api/logout', {}, bob.cookie, alice.account.id)).response.status).toBe(409)
  const logout = await call('POST', '/api/logout', {}, alice.cookie, alice.account.id)
  expect(logout.response.status).toBe(200)
  expect(logout.response.headers.get('set-cookie')).toContain('Max-Age=0')
  expect((await call<SessionReply>('GET', '/api/session', undefined, alice.cookie)).data.account).toBeNull()
  expect((await call('GET', '/api/progress', undefined, alice.cookie, alice.account.id)).response.status).toBe(401)
  expect((await call<SessionReply>('GET', '/api/session', undefined, bob.cookie)).data.account).toEqual(bob.account)
})

test('treats names as unique normalized identifiers and preserves four-digit PIN leading zeros', async () => {
  const alice = await signup(' Alice  Example ')
  expect(alice.account.name).toBe('Alice Example')
  expect((await call('POST', '/api/signup', { name: 'Ａｌｉｃｅ Example', pin: '9999' })).data.error.code).toBe('name_taken')
  expect((await call<SessionReply>('POST', '/api/login', { name: 'alice example', pin: '0123' })).data.account).toEqual(alice.account)
  expect((await call('POST', '/api/login', { name: 'alice example', pin: 123 })).response.status).toBe(400)
  expect((await call('POST', '/api/signup', { name: '<script>', pin: '1234' })).response.status).toBe(400)
  expect((await call('POST', '/api/signup', { name: 'Other', pin: '12345' })).response.status).toBe(400)
})

test('limits account guesses durably across server restarts and later permits retry', async () => {
  await signup()
  for (let index = 0; index < 5; index++) expect((await call('POST', '/api/login', { name: 'Alice', pin: '9999' })).response.status).toBe(401)
  await restart()
  const blocked = await call('POST', '/api/login', { name: 'ALICE', pin: '0123' })
  expect(blocked.response.status).toBe(429)
  expect(blocked.response.headers.get('retry-after')).toBe('900')
  now += 15 * 60_000
  expect((await call<SessionReply>('POST', '/api/login', { name: 'Alice', pin: '0123' })).response.status).toBe(200)
}, 15_000)

test('enforces the daily account guess ceiling even after the short lockout expires', async () => {
  await signup()
  for (let batch = 0; batch < 2; batch++) {
    for (let index = 0; index < 5; index++) expect((await call('POST', '/api/login', { name: 'Alice', pin: '9999' })).response.status).toBe(401)
    now += 15 * 60_000
  }
  await restart()
  expect((await call('POST', '/api/login', { name: 'Alice', pin: '0123' })).response.status).toBe(429)
  now += 24 * 60 * 60_000
  expect((await call('POST', '/api/login', { name: 'Alice', pin: '0123' })).response.status).toBe(200)
}, 15_000)

test('uses generic login failures and rejects forged or expired sessions without losing progress', async () => {
  const alice = await signup()
  const wrong = await call('POST', '/api/login', { name: 'Alice', pin: '9999' })
  const missing = await call('POST', '/api/login', { name: 'Nobody', pin: '9999' })
  expect(missing.response.status).toBe(wrong.response.status)
  expect(missing.data).toEqual(wrong.data)
  expect((await call<SessionReply>('GET', '/api/session', undefined, `sqlflashcards_session=${'x'.repeat(43)}`)).data.account).toBeNull()
  now += 30 * 24 * 60 * 60_000
  expect((await call<SessionReply>('GET', '/api/session', undefined, alice.cookie)).data.account).toBeNull()
})

test('ignores spoofed forwarding headers from untrusted peers when limiting signup requests', async () => {
  for (let index = 1; index <= 5; index++) {
    expect((await call('POST', '/api/signup', { name: 'x', pin: '0123' }, undefined, undefined, { 'X-Forwarded-For': `192.0.2.${index}` })).response.status).toBe(400)
  }
  expect((await call('POST', '/api/signup', { name: 'x', pin: '0123' }, undefined, undefined, { 'X-Forwarded-For': '192.0.2.100' })).response.status).toBe(429)
})

test('uses only the final valid client IP from an explicitly trusted proxy peer', async () => {
  await restart({ trustedProxyAddress: '::ffff:127.0.0.1' })
  for (let index = 1; index <= 5; index++) {
    expect((await call('POST', '/api/signup', { name: 'x', pin: '0123' }, undefined, undefined, { 'X-Forwarded-For': `198.51.100.${index}, 192.0.2.1` })).response.status).toBe(400)
  }
  expect((await call('POST', '/api/signup', { name: 'x', pin: '0123' }, undefined, undefined, { 'X-Forwarded-For': '192.0.2.1' })).response.status).toBe(429)
  expect((await call('POST', '/api/signup', { name: 'x', pin: '0123' }, undefined, undefined, { 'X-Forwarded-For': '192.0.2.2' })).response.status).toBe(400)
  expect(() => createAccountServer({ databasePath: ':memory:', pepper, origin, trustedProxyAddress: '*' })).toThrow('one exact IP address')
})

test('serializes same-version writes and returns stale state without overwriting it', async () => {
  const alice = await signup()
  const writes = await Promise.all([
    call<SaveReply>('PUT', '/api/progress/basic-queries', { covered: true, expectedVersion: 0 }, alice.cookie, alice.account.id),
    call<SaveReply>('PUT', '/api/progress/basic-queries', { covered: false, expectedVersion: 0 }, alice.cookie, alice.account.id),
  ])
  expect(writes.map((write) => write.data.kind).sort()).toEqual(['saved', 'stale'])
  const rows = (await call<ProgressReply>('GET', '/api/progress', undefined, alice.cookie, alice.account.id)).data.progress
  expect(rows).toHaveLength(1)
  expect(rows[0]?.version).toBe(1)
  expect(writes.find((write) => write.data.kind === 'stale')?.data).toEqual({ kind: 'stale', current: rows[0] })
})

test('validates active content and progress versions, ignores client timestamps, and bounds bodies', async () => {
  const alice = await signup()
  for (const [topic, body] of [
    ['missing', { covered: true, expectedVersion: 0 }],
    ['database-fundamentals', { covered: true, expectedVersion: 0 }],
    ['basic-queries', { covered: 'true', expectedVersion: 0 }],
    ['basic-queries', { covered: true, expectedVersion: -1 }],
  ] as const) expect((await call('PUT', `/api/progress/${topic}`, body, alice.cookie, alice.account.id)).response.status).toBe(400)
  expect((await call('POST', '/api/signup', { name: 'x'.repeat(5000), pin: '0123' })).response.status).toBe(413)
  const saved = await call<SaveReply>('PUT', '/api/progress/basic-queries', { covered: true, expectedVersion: 0, changedAt: '1900-01-01T00:00:00.000Z' }, alice.cookie, alice.account.id)
  if (saved.data.kind !== 'saved') throw new Error('Expected a successful save')
  expect(saved.data.progress.updatedAt).toBe('2026-11-22T12:00:00.000Z')
})

test('refuses incompatible database versions or a wrong pepper without resetting accounts', async () => {
  const alice = await signup()
  await api.close()
  running.delete(api)
  expect(() => createAccountServer({ databasePath, pepper: 'another-stable-secret-that-is-wrong-for-this-database', origin })).toThrow('does not match')
  let db = new DatabaseSync(databasePath)
  db.exec('PRAGMA user_version = 2')
  db.close()
  expect(() => createAccountServer({ databasePath, pepper, origin })).toThrow('Unsupported account database schema')
  db = new DatabaseSync(databasePath)
  expect(db.prepare('SELECT id FROM accounts').get()?.id).toBe(alice.account.id)
  db.close()
})

test('serves only the built static directory and supplies CSP and no-store account responses', async () => {
  const staticDirectory = join(directory, 'dist')
  await mkdir(staticDirectory)
  await writeFile(join(staticDirectory, 'index.html'), '<h1>SQLFlashCards</h1>')
  await writeFile(join(directory, 'private.txt'), 'private')
  await restart({ staticDirectory })
  const page = await fetch(`${url}/`)
  expect(page.status).toBe(200)
  expect(page.headers.get('content-security-policy')).toContain("frame-ancestors 'none'")
  expect(await page.text()).toContain('SQLFlashCards')
  expect((await fetch(`${url}/%2e%2e%2fprivate.txt`)).status).toBe(404)
  expect((await call<SessionReply>('GET', '/api/session')).response.headers.get('cache-control')).toBe('no-store')
  expect(() => createAccountServer({ databasePath: ':memory:', pepper, origin: 'http://example.test', secureCookies: true })).toThrow('HTTPS')
})
