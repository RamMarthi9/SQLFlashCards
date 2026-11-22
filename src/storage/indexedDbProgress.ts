import type { CoverageChange, CoverageResult, ProgressRepository, TopicProgress } from '../domain/progress'

type StorageErrorCode = 'unavailable' | 'blocked' | 'migration' | 'corrupt' | 'quota' | 'aborted'

const messages: Record<StorageErrorCode, string> = {
  unavailable: 'Browser storage is unavailable. Allow site storage and try again.',
  blocked: 'Another tab is blocking saved progress. Close other SQLFlashCards tabs and try again.',
  migration: 'This saved progress needs a compatible app version. Reload the app and try again; your data has not been erased.',
  corrupt: 'Saved progress could not be read safely. Your data has been kept; try reloading the app.',
  quota: 'The browser could not save progress because storage is full. Free some browser storage and try again.',
  aborted: 'The progress operation was interrupted. Please try again.',
}

export class ProgressStorageError extends Error {
  readonly code: StorageErrorCode
  constructor(code: StorageErrorCode, cause?: unknown) {
    super(messages[code], { cause })
    this.name = 'ProgressStorageError'
    this.code = code
  }
}

function storageError(error: unknown, fallback: StorageErrorCode): ProgressStorageError {
  if (error instanceof ProgressStorageError) return error
  const name = error && typeof error === 'object' && 'name' in error ? error.name : ''
  if (name === 'QuotaExceededError') return new ProgressStorageError('quota', error)
  if (name === 'VersionError') return new ProgressStorageError('migration', error)
  if (name === 'SecurityError' || name === 'NotAllowedError') return new ProgressStorageError('unavailable', error)
  return new ProgressStorageError(fallback, error)
}

function isInstant(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && date.toISOString() === value
}

function isTopicId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
}

function readProgress(value: unknown): TopicProgress {
  if (!value || typeof value !== 'object') throw new ProgressStorageError('corrupt')
  if (!('topicId' in value) || !isTopicId(value.topicId)
    || !('covered' in value) || typeof value.covered !== 'boolean'
    || !('coveredAt' in value) || (value.covered ? !isInstant(value.coveredAt) : value.coveredAt !== null)
    || !('updatedAt' in value) || !isInstant(value.updatedAt)
    || !('version' in value) || typeof value.version !== 'number' || !Number.isSafeInteger(value.version) || value.version < 1) {
    throw new ProgressStorageError('corrupt')
  }
  return { topicId: value.topicId, covered: value.covered, coveredAt: value.coveredAt as string | null, updatedAt: value.updatedAt, version: value.version }
}

const storeName = 'topicProgress'
const schemaVersion = 1

export function createProgressRepository(options: { factory?: IDBFactory; databaseName?: string } = {}): ProgressRepository {
  let database: IDBDatabase | null = null
  let pending: Promise<IDBDatabase> | null = null
  let generation = 0

  function open(): Promise<IDBDatabase> {
    if (database) return Promise.resolve(database)
    if (pending) return pending
    const attempt = generation
    const opening = new Promise<IDBDatabase>((resolve, reject) => {
      let request: IDBOpenDBRequest
      let abandoned = false
      let upgradeError: ProgressStorageError | undefined
      try {
        const factory = options.factory ?? globalThis.indexedDB
        if (!factory) throw new ProgressStorageError('unavailable')
        request = factory.open(options.databaseName ?? 'sqlflashcards', schemaVersion)
      } catch (error) {
        reject(storageError(error, 'unavailable'))
        return
      }
      request.onblocked = () => {
        abandoned = true
        reject(new ProgressStorageError('blocked'))
      }
      request.onupgradeneeded = (event) => {
        try {
          // A failed/abandoned open must not perform a delayed migration after a retry.
          if (abandoned || attempt !== generation) throw new ProgressStorageError('aborted')
          if (event.oldVersion === 0) request.result.createObjectStore(storeName, { keyPath: 'topicId' })
        } catch (error) {
          upgradeError = storageError(error, 'migration')
          request.transaction?.abort()
        }
      }
      request.onerror = () => reject(upgradeError ?? storageError(request.error, 'unavailable'))
      request.onsuccess = () => {
        const opened = request.result
        if (abandoned || attempt !== generation) {
          opened.close()
          reject(new ProgressStorageError('aborted'))
          return
        }
        try {
          if (!opened.objectStoreNames.contains(storeName)) throw new ProgressStorageError('migration')
          const store = opened.transaction(storeName).objectStore(storeName)
          if (store.keyPath !== 'topicId' || store.autoIncrement) throw new ProgressStorageError('migration')
        } catch (error) {
          opened.close()
          reject(storageError(error, 'migration'))
          return
        }
        database = opened
        const release = () => {
          opened.close()
          if (database === opened) database = null
        }
        opened.onversionchange = release
        opened.onclose = release
        resolve(opened)
      }
    })
    pending = opening
    void opening.then(
      () => { if (pending === opening) pending = null },
      () => { if (pending === opening) pending = null },
    )
    return opening
  }

  async function transact<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore, done: (value: T) => void, fail: (error: unknown) => void) => void): Promise<T> {
    const db = await open()
    return new Promise<T>((resolve, reject) => {
      let transaction: IDBTransaction
      try { transaction = db.transaction(storeName, mode) }
      catch (error) { reject(storageError(error, 'aborted')); return }
      let result: { value: T } | undefined
      let failure: unknown
      transaction.oncomplete = () => {
        if (result && !failure) resolve(result.value)
        else reject(storageError(failure, 'aborted'))
      }
      transaction.onerror = () => { failure ??= transaction.error }
      transaction.onabort = () => reject(storageError(failure ?? transaction.error, 'aborted'))
      const fail = (error: unknown) => {
        failure = error
        try { transaction.abort() }
        catch { reject(storageError(error, 'aborted')) }
      }
      try { work(transaction.objectStore(storeName), (value) => { result = { value } }, fail) }
      catch (error) { fail(error) }
    })
  }

  return {
    getAll() {
      return transact<TopicProgress[]>('readonly', (store, done, fail) => {
        const request = store.getAll()
        request.onsuccess = () => {
          try { done((request.result as unknown[]).map(readProgress)) }
          catch (error) { fail(error) }
        }
      })
    },
    setTopicCovered(command: CoverageChange) {
      const input = { ...command }
      if (!isTopicId(input.topicId) || typeof input.covered !== 'boolean' || !isInstant(input.changedAt)
        || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0) {
        return Promise.reject(new TypeError('Invalid topic progress change.'))
      }
      return transact<CoverageResult>('readwrite', (store, done, fail) => {
        const request = store.get(input.topicId)
        request.onsuccess = () => {
          try {
            const raw: unknown = request.result
            const current = raw === undefined ? null : readProgress(raw)
            if ((current?.version ?? 0) !== input.expectedVersion) {
              done({ kind: 'stale', current })
              return
            }
            const version = input.expectedVersion + 1
            if (!Number.isSafeInteger(version)) throw new ProgressStorageError('corrupt')
            const progress: TopicProgress = {
              topicId: input.topicId,
              covered: input.covered,
              coveredAt: input.covered ? (current?.coveredAt ?? input.changedAt) : null,
              updatedAt: input.changedAt,
              version,
            }
            store.put(progress)
            done({ kind: 'saved', progress })
          } catch (error) { fail(error) }
        }
      })
    },
    close() {
      generation += 1
      database?.close()
      database = null
      pending = null
    },
  }
}
