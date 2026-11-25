import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { Pool, type PoolClient, type PoolConfig } from 'pg'
import { ApiError, credentials, progressRow, type Account, type AccountRepository, type SaveResult } from './accountTypes.js'
import { hash, pepperMarker, PinHasher, quarterHour, sessionDuration } from './accountCrypto.js'

interface StoreOptions { schema?: string; allowInsecureLocalhost?: boolean }
interface Limit { key: string; limit: number; duration: number }
type Row = Record<string, unknown>

function connectionConfig(connectionString: string, allowInsecureLocalhost: boolean): PoolConfig {
  let url: URL
  try { url = new URL(connectionString) } catch { throw new Error('DATABASE_URL must be a PostgreSQL connection URL.') }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) throw new Error('DATABASE_URL must be a PostgreSQL connection URL.')
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  // pg URL SSL options can override the explicit ssl object. Always select verified
  // TLS here, except for an explicitly permitted local test/development server.
  for (const key of ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat']) url.searchParams.delete(key)
  return {
    connectionString: url.toString(),
    ssl: local && allowInsecureLocalhost ? false : { rejectUnauthorized: true },
    max: 2,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
    statement_timeout: 8_000,
    query_timeout: 10_000,
    application_name: 'sqlflashcards',
  }
}

/** Durable remote storage. A pool/instance may be reused but correctness lives in PostgreSQL. */
export class PostgresAccountStore implements AccountRepository {
  private readonly hasher: PinHasher
  private constructor(private readonly pool: Pool, pepper: string, private readonly now: () => number, private readonly schema: string) {
    this.hasher = new PinHasher(pepper)
    // An idle connection can be closed by the provider. pg removes it from the pool;
    // handling the event prevents a process crash and avoids logging credentials.
    pool.on('error', () => { /* The next request obtains another connection. */ })
  }

  static async open(connectionString: string, pepper: string, now: () => number = Date.now, options: StoreOptions = {}) {
    if (pepper.length < 32) throw new Error('The PIN pepper must contain at least 32 characters.')
    const schema = options.schema ?? 'sqlflashcards'
    if (!/^[a-z][a-z0-9_]{0,62}$/.test(schema)) throw new Error('Invalid database schema name.')
    const pool = new Pool(connectionConfig(connectionString, options.allowInsecureLocalhost === true))
    const store = new PostgresAccountStore(pool, pepper, now, schema)
    try { await store.initialize(pepper); return store }
    catch (error) { await pool.end(); throw error }
  }

  private table(name: string) { return `"${this.schema}"."${name}"` }

  private async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    let discard = false
    try {
      await client.query('BEGIN')
      const result = await work(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      try { await client.query('ROLLBACK') } catch { discard = true }
      throw error
    } finally { client.release(discard) }
  }

  private async lock(client: PoolClient, key: string) {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`sqlflashcards:${this.schema}:${key}`])
  }

  private async initialize(pepper: string) {
    await this.transaction(async (client) => {
      await this.lock(client, 'schema')
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${this.schema}"`)
      await client.query(`CREATE TABLE IF NOT EXISTS ${this.table('configuration')} (key TEXT PRIMARY KEY, value TEXT NOT NULL)`)
      const version = (await client.query<Row>(`SELECT value FROM ${this.table('configuration')} WHERE key = 'schema-version'`)).rows[0]?.value
      if (version !== undefined && version !== '1') throw new Error('Unsupported account database schema; data has not been reset.')
      if (version === undefined) {
        const existing = await client.query<Row>('SELECT to_regclass($1) AS existing', [`${this.schema}.accounts`])
        if (existing.rows[0]?.existing) throw new Error('Account tables exist without a schema version; data has not been reset.')
        await client.query(`
          CREATE TABLE ${this.table('accounts')} (id TEXT PRIMARY KEY, name TEXT NOT NULL, normalized_name TEXT NOT NULL UNIQUE, pin_salt TEXT NOT NULL, pin_hash TEXT NOT NULL, created_at BIGINT NOT NULL);
          CREATE TABLE ${this.table('sessions')} (token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES ${this.table('accounts')}(id), expires_at BIGINT NOT NULL);
          CREATE INDEX sessions_expiry ON ${this.table('sessions')}(expires_at);
          CREATE TABLE ${this.table('topic_progress')} (account_id TEXT NOT NULL REFERENCES ${this.table('accounts')}(id), topic_id TEXT NOT NULL, covered INTEGER NOT NULL CHECK(covered IN (0,1)), covered_at TEXT, updated_at TEXT NOT NULL, version BIGINT NOT NULL CHECK(version > 0), PRIMARY KEY(account_id, topic_id));
          CREATE TABLE ${this.table('auth_limits')} (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, resets_at BIGINT NOT NULL);
          CREATE INDEX auth_limits_expiry ON ${this.table('auth_limits')}(resets_at);
          INSERT INTO ${this.table('configuration')}(key, value) VALUES ('schema-version', '1');
        `)
      }
      const marker = pepperMarker(pepper)
      const configured = (await client.query<Row>(`SELECT value FROM ${this.table('configuration')} WHERE key = 'pepper-check'`)).rows[0]
      if (version !== undefined && !configured) throw new Error('The account database is missing its PIN pepper marker; data has not been reset.')
      if (configured && configured.value !== marker) throw new Error('The configured PIN pepper does not match the account database. Restore the original secret.')
      await client.query(`INSERT INTO ${this.table('configuration')}(key, value) VALUES ('pepper-check', $1) ON CONFLICT(key) DO NOTHING`, [marker])
    })
  }

  private async reserveLimits(limits: Limit[]) {
    // Bound expired-key growth without waiting on rows held by another request.
    await this.pool.query(`DELETE FROM ${this.table('auth_limits')} WHERE key IN
      (SELECT key FROM ${this.table('auth_limits')} WHERE resets_at <= $1 ORDER BY resets_at LIMIT 100 FOR UPDATE SKIP LOCKED)`, [this.now()])
    await this.transaction(async (client) => {
      // Missing rows also need serialization: row locks alone do not protect the
      // first attempt. A stable sorted lock order avoids deadlocks across accounts.
      for (const key of limits.map((limit) => limit.key).sort()) await this.lock(client, `limit:${key}`)
      const now = this.now()
      for (const { key, limit } of limits) {
        const entry = (await client.query<Row>(`SELECT attempts, resets_at FROM ${this.table('auth_limits')} WHERE key = $1`, [key])).rows[0]
        if (entry && Number(entry.resets_at) > now && Number(entry.attempts) >= limit) throw new ApiError(429, 'rate_limited', 'Too many attempts. Please wait before trying again.', Math.max(1, Math.ceil((Number(entry.resets_at) - now) / 1000)))
      }
      for (const { key, duration } of limits) {
        await client.query(`INSERT INTO ${this.table('auth_limits')} AS limits(key, attempts, resets_at) VALUES ($1, 1, $2)
          ON CONFLICT(key) DO UPDATE SET attempts = CASE WHEN limits.resets_at <= $3 THEN 1 ELSE limits.attempts + 1 END,
          resets_at = CASE WHEN limits.resets_at <= $3 THEN EXCLUDED.resets_at ELSE limits.resets_at END`, [key, now + duration, now])
      }
    })
  }

  async signup(body: Record<string, unknown>, ip: string): Promise<Account> {
    await this.reserveLimits([{ key: `signup:${hash(ip)}`, limit: 5, duration: 60 * 60_000 }])
    const { name, normalized, pin } = credentials(body)
    const salt = randomBytes(16).toString('hex')
    const pinHash = (await this.hasher.derive(pin, salt)).toString('hex')
    const account = { id: randomUUID(), name }
    try {
      await this.pool.query(`INSERT INTO ${this.table('accounts')}(id, name, normalized_name, pin_salt, pin_hash, created_at) VALUES ($1, $2, $3, $4, $5, $6)`, [account.id, name, normalized, salt, pinHash, this.now()])
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505' && 'constraint' in error && error.constraint === 'accounts_normalized_name_key') {
        throw new ApiError(409, 'name_taken', 'That name is already in use. Choose another name or sign in.')
      }
      throw error
    }
    return account
  }

  async login(body: Record<string, unknown>, ip: string): Promise<Account> {
    const { normalized, pin } = credentials(body)
    const accountKey = `account:${hash(normalized)}`
    const dailyKey = `account-day:${hash(normalized)}`
    await this.reserveLimits([
      { key: accountKey, limit: 5, duration: quarterHour },
      { key: dailyKey, limit: 10, duration: 24 * 60 * 60_000 },
      { key: `login:${hash(ip)}`, limit: 20, duration: quarterHour },
    ])
    const account = (await this.pool.query<Row>(`SELECT id, name, pin_salt, pin_hash FROM ${this.table('accounts')} WHERE normalized_name = $1`, [normalized])).rows[0]
    const candidate = await this.hasher.derive(pin, typeof account?.pin_salt === 'string' ? account.pin_salt : '0'.repeat(32))
    const expected = Buffer.from(typeof account?.pin_hash === 'string' ? account.pin_hash : '0'.repeat(128), 'hex')
    if (!account || expected.length !== candidate.length || !timingSafeEqual(candidate, expected)) throw new ApiError(401, 'invalid_login', 'The name or PIN is incorrect.')
    await this.transaction(async (client) => {
      for (const key of [accountKey, dailyKey].sort()) await this.lock(client, `limit:${key}`)
      await client.query(`DELETE FROM ${this.table('auth_limits')} WHERE key = ANY($1::text[])`, [[accountKey, dailyKey]])
    })
    return { id: String(account.id), name: String(account.name) }
  }

  async createSession(account: Account) {
    const token = randomBytes(32).toString('base64url')
    await this.transaction(async (client) => {
      await client.query(`DELETE FROM ${this.table('sessions')} WHERE expires_at <= $1`, [this.now()])
      await client.query(`INSERT INTO ${this.table('sessions')}(token_hash, account_id, expires_at) VALUES ($1, $2, $3)`, [hash(token), account.id, this.now() + sessionDuration])
    })
    return token
  }

  async session(token: string | null): Promise<Account | null> {
    if (!token) return null
    const account = (await this.pool.query<Row>(`SELECT a.id, a.name FROM ${this.table('sessions')} s JOIN ${this.table('accounts')} a ON a.id = s.account_id WHERE s.token_hash = $1 AND s.expires_at > $2`, [hash(token), this.now()])).rows[0]
    return account ? { id: String(account.id), name: String(account.name) } : null
  }

  async logout(token: string | null) { if (token) await this.pool.query(`DELETE FROM ${this.table('sessions')} WHERE token_hash = $1`, [hash(token)]) }

  async getAll(accountId: string) {
    return (await this.pool.query<Row>(`SELECT topic_id, covered, covered_at, updated_at, version FROM ${this.table('topic_progress')} WHERE account_id = $1 ORDER BY topic_id`, [accountId])).rows.map(progressRow)
  }

  async setCovered(accountId: string, topicId: string, covered: boolean, expectedVersion: number): Promise<SaveResult> {
    return this.transaction(async (client) => {
      await this.lock(client, `progress:${JSON.stringify([accountId, topicId])}`)
      const row = (await client.query<Row>(`SELECT topic_id, covered, covered_at, updated_at, version FROM ${this.table('topic_progress')} WHERE account_id = $1 AND topic_id = $2`, [accountId, topicId])).rows[0]
      const current = row ? progressRow(row) : null
      if ((current?.version ?? 0) !== expectedVersion) return { kind: 'stale', current }
      if (!Number.isSafeInteger(expectedVersion + 1)) throw new ApiError(400, 'invalid_progress', 'The progress version is invalid.')
      const updatedAt = new Date(this.now()).toISOString()
      const progress = { topicId, covered, coveredAt: covered ? current?.coveredAt ?? updatedAt : null, updatedAt, version: expectedVersion + 1 }
      await client.query(`INSERT INTO ${this.table('topic_progress')}(account_id, topic_id, covered, covered_at, updated_at, version) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT(account_id, topic_id) DO UPDATE SET covered = EXCLUDED.covered, covered_at = EXCLUDED.covered_at, updated_at = EXCLUDED.updated_at, version = EXCLUDED.version`, [accountId, topicId, covered ? 1 : 0, progress.coveredAt, updatedAt, progress.version])
      return { kind: 'saved', progress }
    })
  }

  async close() { await this.pool.end() }
}
