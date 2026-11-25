export interface Account { id: string; name: string }
export interface Progress { topicId: string; covered: boolean; coveredAt: string | null; updatedAt: string; version: number }
export type SaveResult = { kind: 'saved'; progress: Progress } | { kind: 'stale'; current: Progress | null }
type MaybePromise<T> = T | Promise<T>

export interface AccountRepository {
  signup(body: Record<string, unknown>, ip: string): Promise<Account>
  login(body: Record<string, unknown>, ip: string): Promise<Account>
  createSession(account: Account): MaybePromise<string>
  session(token: string | null): MaybePromise<Account | null>
  logout(token: string | null): MaybePromise<void>
  getAll(accountId: string): MaybePromise<Progress[]>
  setCovered(accountId: string, topicId: string, covered: boolean, expectedVersion: number): MaybePromise<SaveResult>
  close(): MaybePromise<void>
}

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly retryAfter?: number) { super(message) }
}

export function credentials(body: Record<string, unknown>) {
  const name = typeof body.name === 'string' ? body.name.normalize('NFKC').trim().replace(/\s+/g, ' ') : ''
  if (name.length < 2 || name.length > 40 || !/^[\p{L}\p{N}_. -]+$/u.test(name) || typeof body.pin !== 'string' || !/^[0-9]{4}$/.test(body.pin)) {
    throw new ApiError(400, 'invalid_credentials', 'Use a name of 2–40 letters, numbers, spaces, dots, underscores or hyphens, and a four-digit PIN.')
  }
  return { name, normalized: name.toLowerCase(), pin: body.pin }
}

export function progressRow(row: Record<string, unknown>): Progress {
  return { topicId: String(row.topic_id), covered: row.covered === 1, coveredAt: typeof row.covered_at === 'string' ? row.covered_at : null, updatedAt: String(row.updated_at), version: Number(row.version) }
}
