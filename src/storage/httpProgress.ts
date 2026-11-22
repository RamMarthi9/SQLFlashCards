import type { CoverageResult, ProgressRepository, TopicProgress } from '../domain/progress'

export interface Account { id: string; name: string }
type RequestMethod = 'GET' | 'POST' | 'PUT'

export class AccountApiError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message)
    this.name = 'AccountApiError'
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function readAccount(value: unknown): Account {
  if (!object(value) || typeof value.id !== 'string' || !value.id || typeof value.name !== 'string' || !value.name) {
    throw new Error('The account service returned an unreadable response. Please retry.')
  }
  return { id: value.id, name: value.name }
}

export async function accountRequest(path: string, method: RequestMethod = 'GET', body?: unknown, accountId?: string, signal?: AbortSignal): Promise<unknown> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (accountId) headers['X-Account-ID'] = accountId
  if (method !== 'GET') {
    headers['Content-Type'] = 'application/json'
    headers['X-SQLFlashCards-Request'] = '1'
  }
  const controller = new AbortController()
  const cancel = () => { controller.abort() }
  if (signal?.aborted) cancel()
  signal?.addEventListener('abort', cancel, { once: true })
  const timeout = setTimeout(cancel, 15_000)
  try {
    let response: Response
    try { response = await fetch(path, {
      method, headers, credentials: 'same-origin', cache: 'no-store',
      ...(method === 'GET' ? {} : { body: JSON.stringify(body ?? {}) }),
      signal: controller.signal,
    }) } catch { throw new Error('Could not reach the account service. Check your connection and retry.') }
    let value: unknown
    try { value = await response.json() }
    catch { throw new Error('The account service returned an unreadable response. Please retry.') }
    if (!response.ok) {
      const error = object(value) && object(value.error) ? value.error : null
      throw new AccountApiError(
        error && typeof error.code === 'string' ? error.code : 'request_failed',
        error && typeof error.message === 'string' ? error.message : 'The account service could not complete this request. Please retry.',
        response.status,
      )
    }
    return value
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', cancel)
  }
}

export async function getSession(signal?: AbortSignal): Promise<Account | null> {
  const value = await accountRequest('/api/session', 'GET', undefined, undefined, signal)
  if (!object(value) || !('account' in value)) throw new Error('The account service returned an unreadable response. Please retry.')
  return value.account === null ? null : readAccount(value.account)
}

export async function authenticateAccount(action: 'signup' | 'login', name: string, pin: string): Promise<Account> {
  const value = await accountRequest(`/api/${action}`, 'POST', { name, pin })
  if (!object(value)) throw new Error('The account service returned an unreadable response. Please retry.')
  return readAccount(value.account)
}

function progressRecord(value: unknown): TopicProgress {
  if (!object(value) || typeof value.topicId !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.topicId)
    || typeof value.covered !== 'boolean' || !Number.isSafeInteger(value.version) || (value.version as number) < 1
    || typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt))
    || (value.covered ? typeof value.coveredAt !== 'string' || !Number.isFinite(Date.parse(value.coveredAt)) : value.coveredAt !== null)) {
    throw new Error('Saved progress could not be read safely. Please retry.')
  }
  return { topicId: value.topicId, covered: value.covered, coveredAt: value.coveredAt as string | null, updatedAt: value.updatedAt, version: value.version as number }
}

export function createHttpProgressRepository(accountId: string, onSessionInvalid: () => void): ProgressRepository {
  const requests = new Set<AbortController>()
  async function request(path: string, method: RequestMethod = 'GET', body?: unknown) {
    const controller = new AbortController()
    requests.add(controller)
    try { return await accountRequest(path, method, body, accountId, controller.signal) }
    catch (error) {
      if (!controller.signal.aborted && error instanceof AccountApiError && (error.status === 401 || error.code === 'account_changed')) onSessionInvalid()
      throw error
    } finally { requests.delete(controller) }
  }
  return {
    async getAll() {
      const value = await request('/api/progress')
      if (object(value) && typeof value.accountId === 'string' && value.accountId !== accountId) {
        onSessionInvalid()
        throw new Error('The signed-in account changed. Sign in again to continue.')
      }
      if (!object(value) || value.accountId !== accountId || !Array.isArray(value.progress)) throw new Error('Saved progress could not be read safely. Please retry.')
      return value.progress.map(progressRecord)
    },
    async setTopicCovered(input) {
      const value = await request(`/api/progress/${encodeURIComponent(input.topicId)}`, 'PUT', { covered: input.covered, expectedVersion: input.expectedVersion })
      if (!object(value)) throw new Error('The save could not be confirmed. Please reload progress before retrying.')
      let result: CoverageResult
      if (value.kind === 'saved') result = { kind: 'saved', progress: progressRecord(value.progress) }
      else if (value.kind === 'stale') result = { kind: 'stale', current: value.current === null ? null : progressRecord(value.current) }
      else throw new Error('The save could not be confirmed. Please reload progress before retrying.')
      const record = result.kind === 'saved' ? result.progress : result.current
      if (record && record.topicId !== input.topicId) throw new Error('The save could not be confirmed. Please reload progress before retrying.')
      return result
    },
    close() { requests.forEach((controller) => controller.abort()); requests.clear() },
  }
}
