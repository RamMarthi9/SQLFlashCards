// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { Pool } from 'pg'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { PostgresAccountStore } from './postgresStore.js'
import { ApiError } from './accountTypes.js'
import { createAccountHandler } from './handler.js'

const connectionString = process.env.TEST_DATABASE_URL
const pepper = 'test-only-postgres-pepper-not-a-production-secret'
const origin = 'https://sqlflashcards.example'

describe.skipIf(!connectionString)('real PostgreSQL account storage', () => {
  let schema: string
  let now: number
  let store: PostgresAccountStore
  let admin: Pool
  const stores = new Set<PostgresAccountStore>()
  const schemas = new Set<string>()
  const servers = new Set<Server>()

  async function open(selectedSchema = schema, selectedPepper = pepper) {
    schemas.add(selectedSchema)
    const opened = await PostgresAccountStore.open(connectionString!, selectedPepper, () => now, { schema: selectedSchema, allowInsecureLocalhost: true })
    stores.add(opened)
    return opened
  }

  beforeEach(async () => {
    schema = `test_sqlflashcards_${randomUUID().replaceAll('-', '')}`
    now = Date.parse('2026-11-25T12:00:00.000Z')
    const url = new URL(connectionString!)
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    for (const key of ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat']) url.searchParams.delete(key)
    admin = new Pool({ connectionString: url.toString(), ssl: local ? false : { rejectUnauthorized: true }, max: 2 })
    store = await open()
  })

  afterEach(async () => {
    for (const server of servers) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    servers.clear()
    for (const opened of stores) await opened.close()
    stores.clear()
    for (const selectedSchema of schemas) {
      if (!/^test_sqlflashcards_[a-f0-9]{32}$/.test(selectedSchema)) throw new Error('Refusing unexpected test schema cleanup')
      await admin.query(`DROP SCHEMA IF EXISTS "${selectedSchema}" CASCADE`)
    }
    schemas.clear()
    await admin.end()
  })

  test('retains separate accounts, leading-zero PINs, hashed sessions and completion across fresh connections', async () => {
    const alice = await store.signup({ name: ' Alice  Example ', pin: '0123' }, '192.0.2.1')
    const bob = await store.signup({ name: 'Bob', pin: '0123' }, '192.0.2.2')
    expect(alice.name).toBe('Alice Example')
    await expect(store.signup({ name: 'Ａｌｉｃｅ Example', pin: '9876' }, '192.0.2.3')).rejects.toMatchObject({ code: 'name_taken' })
    const token = await store.createSession(alice)
    expect(await store.setCovered(alice.id, 'basic-queries', true, 0)).toEqual({ kind: 'saved', progress: { topicId: 'basic-queries', covered: true, coveredAt: '2026-11-25T12:00:00.000Z', updatedAt: '2026-11-25T12:00:00.000Z', version: 1 } })
    expect(await store.getAll(bob.id)).toEqual([])
    await store.close()
    stores.delete(store)
    const reopened = await open()
    expect(await reopened.session(token)).toEqual(alice)
    expect(await reopened.login({ name: 'alice example', pin: '0123' }, '192.0.2.4')).toEqual(alice)
    expect(await reopened.getAll(alice.id)).toEqual([expect.objectContaining({ covered: true, version: 1 })])
    expect(await reopened.setCovered(alice.id, 'basic-queries', false, 1)).toMatchObject({ kind: 'saved', progress: { covered: false, coveredAt: null, version: 2 } })
    const accounts = (await admin.query<{ pin_hash: string; pin_salt: string }>(`SELECT pin_hash, pin_salt FROM "${schema}".accounts ORDER BY name`)).rows
    expect(accounts).toHaveLength(2)
    expect(accounts[0]?.pin_hash).toHaveLength(128)
    expect(accounts[0]?.pin_hash).not.toBe(accounts[1]?.pin_hash)
    expect(accounts[0]?.pin_salt).not.toBe(accounts[1]?.pin_salt)
    const tokens = (await admin.query<{ token_hash: string }>(`SELECT token_hash FROM "${schema}".sessions`)).rows
    expect(tokens[0]?.token_hash).toHaveLength(64)
    expect(tokens[0]?.token_hash).not.toBe(token)
    await reopened.logout(token)
    expect(await reopened.session(token)).toBeNull()
  }, 20_000)

  test('serializes competing first and subsequent topic writes across independent instances', async () => {
    const account = await store.signup({ name: 'Alice', pin: '0123' }, '192.0.2.1')
    const other = await open()
    const first = await Promise.all([store.setCovered(account.id, 'joins', true, 0), other.setCovered(account.id, 'joins', false, 0)])
    expect(first.filter((value) => value.kind === 'saved')).toHaveLength(1)
    expect(first.filter((value) => value.kind === 'stale')).toHaveLength(1)
    expect(first.find((value) => value.kind === 'stale')).toMatchObject({ current: { version: 1 } })
    const next = await Promise.all([store.setCovered(account.id, 'joins', false, 1), other.setCovered(account.id, 'joins', true, 1)])
    expect(next.filter((value) => value.kind === 'saved')).toHaveLength(1)
    expect(next.filter((value) => value.kind === 'stale')).toHaveLength(1)
    expect(next.find((value) => value.kind === 'stale')).toMatchObject({ current: { version: 2 } })
    expect(await store.getAll(account.id)).toEqual([expect.objectContaining({ version: 2 })])
  })

  test('does not overrun sign-up limits when many instances reserve the same initially absent counter', async () => {
    const other = await open()
    const attempts = await Promise.all(Array.from({ length: 16 }, (_, index) => (index % 2 ? store : other).signup({ name: '<invalid>', pin: '0123' }, '192.0.2.1').catch((error: unknown) => error)))
    expect(attempts.filter((value) => value instanceof ApiError && value.code === 'invalid_credentials')).toHaveLength(5)
    expect(attempts.filter((value) => value instanceof ApiError && value.code === 'rate_limited')).toHaveLength(11)
    const reopened = await open()
    await expect(reopened.signup({ name: 'Alice', pin: '0123' }, '192.0.2.1')).rejects.toMatchObject({ code: 'rate_limited', retryAfter: 3600 })
    now += 60 * 60_000
    await expect(reopened.signup({ name: 'Alice', pin: '0123' }, '192.0.2.1')).resolves.toMatchObject({ name: 'Alice' })
  }, 20_000)

  test('enforces account limits across IPs and fresh instances and allows retry after expiry', async () => {
    const account = await store.signup({ name: 'Alice', pin: '0123' }, '192.0.2.1')
    const other = await open()
    for (let index = 0; index < 5; index++) await expect((index % 2 ? store : other).login({ name: 'ALICE', pin: '9999' }, `198.51.100.${index}`)).rejects.toMatchObject({ code: 'invalid_login' })
    const reopened = await open()
    await expect(reopened.login({ name: 'Alice', pin: '0123' }, '203.0.113.10')).rejects.toMatchObject({ code: 'rate_limited', retryAfter: 900 })
    now += 15 * 60_000
    expect(await reopened.login({ name: 'Alice', pin: '0123' }, '203.0.113.10')).toEqual(account)
  }, 20_000)

  test('retains the daily guess ceiling beyond the short-window expiry', async () => {
    await store.signup({ name: 'Alice', pin: '0123' }, '192.0.2.1')
    for (let batch = 0; batch < 2; batch++) {
      for (let index = 0; index < 5; index++) await expect(store.login({ name: 'Alice', pin: '9999' }, `198.51.100.${index}`)).rejects.toMatchObject({ code: 'invalid_login' })
      now += 15 * 60_000
    }
    await expect(store.login({ name: 'Alice', pin: '0123' }, '203.0.113.1')).rejects.toMatchObject({ code: 'rate_limited' })
    now += 24 * 60 * 60_000
    await expect(store.login({ name: 'Alice', pin: '0123' }, '203.0.113.1')).resolves.toMatchObject({ name: 'Alice' })
  }, 20_000)

  test('expires sessions without deleting progress and rejects a changed pepper without mutating data', async () => {
    const account = await store.signup({ name: 'Alice', pin: '0123' }, '192.0.2.1')
    const token = await store.createSession(account)
    await store.setCovered(account.id, 'joins', true, 0)
    await expect(open(schema, 'a-different-test-pepper-that-is-long-enough')).rejects.toThrow('does not match')
    expect(await store.session(token)).toEqual(account)
    now += 30 * 24 * 60 * 60_000
    expect(await store.session(token)).toBeNull()
    expect(await store.session('forged')).toBeNull()
    expect(await store.getAll(account.id)).toEqual([expect.objectContaining({ covered: true })])
  })

  test('initializes an empty schema safely across simultaneous cold starts and refuses unsupported schema versions', async () => {
    const freshSchema = `test_sqlflashcards_${randomUUID().replaceAll('-', '')}`
    const [first, second] = await Promise.all([open(freshSchema), open(freshSchema)])
    const account = await first.signup({ name: 'Alice', pin: '0123' }, '192.0.2.1')
    expect(await second.login({ name: 'Alice', pin: '0123' }, '192.0.2.2')).toEqual(account)
    await admin.query(`UPDATE "${freshSchema}".configuration SET value = '999' WHERE key = 'schema-version'`)
    await expect(open(freshSchema)).rejects.toThrow('Unsupported account database schema')
    expect(await second.login({ name: 'Alice', pin: '0123' }, '192.0.2.3')).toEqual(account)
  }, 20_000)

  test('serves separate account cookies and saved progress through the real async HTTP handler', async () => {
    const handler = createAccountHandler({ store, origin, secureCookies: true })
    const server = createServer((request, response) => { void handler(request, response) })
    servers.add(server)
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    async function request(path: string, method = 'GET', body?: unknown, cookie?: string, accountId?: string) {
      return fetch(`${base}${path}`, { method, headers: { Origin: origin, 'Content-Type': 'application/json', 'X-SQLFlashCards-Request': '1', ...(cookie ? { Cookie: cookie } : {}), ...(accountId ? { 'X-Account-ID': accountId } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    }
    const aliceResponse = await request('/api/signup', 'POST', { name: 'Alice', pin: '0123' })
    expect(aliceResponse.status).toBe(200)
    const alice = await aliceResponse.json() as { account: { id: string } }
    const aliceCookie = aliceResponse.headers.get('set-cookie')!.split(';')[0]!
    expect(aliceResponse.headers.get('set-cookie')).toContain('Secure')
    expect((await request('/api/progress/joins', 'PUT', { covered: true, expectedVersion: 0 }, aliceCookie, alice.account.id)).status).toBe(200)
    const bobResponse = await request('/api/signup', 'POST', { name: 'Bob', pin: '9876' })
    const bob = await bobResponse.json() as { account: { id: string } }
    const bobCookie = bobResponse.headers.get('set-cookie')!.split(';')[0]!
    expect(await (await request('/api/progress', 'GET', undefined, bobCookie, bob.account.id)).json()).toEqual({ accountId: bob.account.id, progress: [] })
    expect((await request('/api/progress', 'GET', undefined, bobCookie, alice.account.id)).status).toBe(409)
    expect(await (await request('/api/progress', 'GET', undefined, aliceCookie, alice.account.id)).json()).toMatchObject({ progress: [{ topicId: 'joins', covered: true, version: 1 }] })
  }, 20_000)
})
