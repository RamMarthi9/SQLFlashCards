import { createHash, createHmac, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'

export interface Account { id: string; name: string }
export interface Progress { topicId: string; covered: boolean; coveredAt: string | null; updatedAt: string; version: number }
export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly retryAfter?: number) { super(message) }
}

const quarterHour = 15 * 60_000
const sessionDuration = 30 * 24 * 60 * 60_000
const hash = (value: string) => createHash('sha256').update(value).digest('hex')

export function credentials(body: Record<string, unknown>) {
  const name = typeof body.name === 'string' ? body.name.normalize('NFKC').trim().replace(/\s+/g, ' ') : ''
  if (name.length < 2 || name.length > 40 || !/^[\p{L}\p{N}_. -]+$/u.test(name) || typeof body.pin !== 'string' || !/^[0-9]{4}$/.test(body.pin)) {
    throw new ApiError(400, 'invalid_credentials', 'Use a name of 2–40 letters, numbers, spaces, dots, underscores or hyphens, and a four-digit PIN.')
  }
  return { name, normalized: name.toLowerCase(), pin: body.pin }
}

export class AccountStore {
  private readonly db: DatabaseSync
  private activeHashes = 0
  constructor(databasePath: string, private readonly pepper: string, private readonly now: () => number) {
    if (pepper.length < 32) throw new Error('The PIN pepper must contain at least 32 characters.')
    this.db = new DatabaseSync(databasePath)
    try {
      this.db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;')
      const version = this.db.prepare('PRAGMA user_version').get()?.user_version
      if (version !== 0 && version !== 1) throw new Error('Unsupported account database schema; data has not been reset.')
      if (version === 0) this.db.exec(`
        BEGIN IMMEDIATE;
        CREATE TABLE accounts (id TEXT PRIMARY KEY, name TEXT NOT NULL, normalized_name TEXT NOT NULL UNIQUE, pin_salt TEXT NOT NULL, pin_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
        CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), expires_at INTEGER NOT NULL);
        CREATE INDEX sessions_expiry ON sessions(expires_at);
        CREATE TABLE topic_progress (account_id TEXT NOT NULL REFERENCES accounts(id), topic_id TEXT NOT NULL, covered INTEGER NOT NULL CHECK(covered IN (0,1)), covered_at TEXT, updated_at TEXT NOT NULL, version INTEGER NOT NULL CHECK(version > 0), PRIMARY KEY(account_id, topic_id));
        CREATE TABLE auth_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, resets_at INTEGER NOT NULL);
        CREATE INDEX auth_limits_expiry ON auth_limits(resets_at);
        CREATE TABLE configuration (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        PRAGMA user_version = 1;
        COMMIT;
      `)
      const marker = createHmac('sha256', pepper).update('sqlflashcards-pin-pepper-v1').digest('hex')
      const configured = this.db.prepare('SELECT value FROM configuration WHERE key = ?').get('pepper-check')
      if (configured && configured.value !== marker) throw new Error('The configured PIN pepper does not match the account database. Restore the original secret.')
      this.db.prepare('INSERT OR IGNORE INTO configuration(key, value) VALUES (?, ?)').run('pepper-check', marker)
    } catch (error) { this.db.close(); throw error }
  }

  private async derive(pin: string, salt: string): Promise<Buffer> {
    if (this.activeHashes >= 2) throw new ApiError(429, 'rate_limited', 'Sign-in is busy. Please try again shortly.', 5)
    this.activeHashes++
    try {
      const input = createHmac('sha256', this.pepper).update(pin).digest()
      return await new Promise<Buffer>((resolve, reject) => {
        scrypt(input, Buffer.from(salt, 'hex'), 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key))
      })
    } finally { this.activeHashes-- }
  }

  private reserveLimits(limits: { key: string; limit: number; duration: number }[]) {
    const now = this.now()
    this.db.exec('BEGIN IMMEDIATE')
    try {
      this.db.prepare('DELETE FROM auth_limits WHERE resets_at <= ?').run(now)
      for (const { key, limit } of limits) {
        const entry = this.db.prepare('SELECT attempts, resets_at FROM auth_limits WHERE key = ?').get(key)
        if (entry && Number(entry.attempts) >= limit) throw new ApiError(429, 'rate_limited', 'Too many attempts. Please wait before trying again.', Math.max(1, Math.ceil((Number(entry.resets_at) - now) / 1000)))
      }
      for (const { key, duration } of limits) {
        this.db.prepare('INSERT INTO auth_limits(key, attempts, resets_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET attempts = attempts + 1').run(key, now + duration)
      }
      this.db.exec('COMMIT')
    } catch (error) { this.db.exec('ROLLBACK'); throw error }
  }

  async signup(body: Record<string, unknown>, ip: string): Promise<Account> {
    this.reserveLimits([{ key: `signup:${hash(ip)}`, limit: 5, duration: 60 * 60_000 }])
    const { name, normalized, pin } = credentials(body)
    const salt = randomBytes(16).toString('hex')
    const pinHash = (await this.derive(pin, salt)).toString('hex')
    const account = { id: randomUUID(), name }
    try {
      this.db.prepare('INSERT INTO accounts(id, name, normalized_name, pin_salt, pin_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(account.id, name, normalized, salt, pinHash, this.now())
    } catch (error) {
      if (this.db.prepare('SELECT id FROM accounts WHERE normalized_name = ?').get(normalized)) throw new ApiError(409, 'name_taken', 'That name is already in use. Choose another name or sign in.')
      throw error
    }
    return account
  }

  async login(body: Record<string, unknown>, ip: string): Promise<Account> {
    const { normalized, pin } = credentials(body)
    const accountKey = `account:${hash(normalized)}`
    const dailyKey = `account-day:${hash(normalized)}`
    this.reserveLimits([
      { key: accountKey, limit: 5, duration: quarterHour },
      { key: dailyKey, limit: 10, duration: 24 * 60 * 60_000 },
      { key: `login:${hash(ip)}`, limit: 20, duration: quarterHour },
    ])
    const account = this.db.prepare('SELECT id, name, pin_salt, pin_hash FROM accounts WHERE normalized_name = ?').get(normalized)
    const candidate = await this.derive(pin, typeof account?.pin_salt === 'string' ? account.pin_salt : '0'.repeat(32))
    const expected = Buffer.from(typeof account?.pin_hash === 'string' ? account.pin_hash : '0'.repeat(128), 'hex')
    if (!account || expected.length !== candidate.length || !timingSafeEqual(candidate, expected)) throw new ApiError(401, 'invalid_login', 'The name or PIN is incorrect.')
    this.db.prepare('DELETE FROM auth_limits WHERE key = ?').run(accountKey)
    this.db.prepare('DELETE FROM auth_limits WHERE key = ?').run(dailyKey)
    return { id: String(account.id), name: String(account.name) }
  }

  createSession(account: Account) {
    const token = randomBytes(32).toString('base64url')
    this.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(this.now())
    this.db.prepare('INSERT INTO sessions(token_hash, account_id, expires_at) VALUES (?, ?, ?)').run(hash(token), account.id, this.now() + sessionDuration)
    return token
  }

  session(token: string | null): Account | null {
    if (!token) return null
    const account = this.db.prepare('SELECT a.id, a.name FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = ? AND s.expires_at > ?').get(hash(token), this.now())
    return account ? { id: String(account.id), name: String(account.name) } : null
  }

  logout(token: string | null) { if (token) this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash(token)) }

  private progressRow(row: Record<string, unknown>): Progress {
    return { topicId: String(row.topic_id), covered: row.covered === 1, coveredAt: typeof row.covered_at === 'string' ? row.covered_at : null, updatedAt: String(row.updated_at), version: Number(row.version) }
  }

  getAll(accountId: string) {
    return this.db.prepare('SELECT topic_id, covered, covered_at, updated_at, version FROM topic_progress WHERE account_id = ? ORDER BY topic_id').all(accountId).map((row) => this.progressRow(row))
  }

  setCovered(accountId: string, topicId: string, covered: boolean, expectedVersion: number) {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const row = this.db.prepare('SELECT topic_id, covered, covered_at, updated_at, version FROM topic_progress WHERE account_id = ? AND topic_id = ?').get(accountId, topicId)
      const current = row ? this.progressRow(row) : null
      if ((current?.version ?? 0) !== expectedVersion) {
        this.db.exec('COMMIT')
        return { kind: 'stale' as const, current }
      }
      if (!Number.isSafeInteger(expectedVersion + 1)) throw new ApiError(400, 'invalid_progress', 'The progress version is invalid.')
      const updatedAt = new Date(this.now()).toISOString()
      const progress: Progress = { topicId, covered, coveredAt: covered ? current?.coveredAt ?? updatedAt : null, updatedAt, version: expectedVersion + 1 }
      this.db.prepare('INSERT INTO topic_progress(account_id, topic_id, covered, covered_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(account_id, topic_id) DO UPDATE SET covered = excluded.covered, covered_at = excluded.covered_at, updated_at = excluded.updated_at, version = excluded.version').run(accountId, topicId, covered ? 1 : 0, progress.coveredAt, updatedAt, progress.version)
      this.db.exec('COMMIT')
      return { kind: 'saved' as const, progress }
    } catch (error) { this.db.exec('ROLLBACK'); throw error }
  }

  close() { this.db.close() }
}
