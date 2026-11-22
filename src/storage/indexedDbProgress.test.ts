// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBDatabase, IDBFactory, IDBObjectStore, IDBVersionChangeEvent } from 'fake-indexeddb'
import type { ProgressRepository, TopicProgress } from '../domain/progress'
import { createProgressRepository } from './indexedDbProgress'

const firstTime = '2026-11-22T08:00:00.000Z'
const laterTime = '2026-11-22T09:00:00.000Z'
const example: TopicProgress = { topicId: 'joins', covered: true, coveredAt: firstTime, updatedAt: firstTime, version: 1 }
let factory: IDBFactory
let repositories: ProgressRepository[]
let connections: globalThis.IDBDatabase[]

beforeEach(() => {
  factory = new IDBFactory()
  repositories = []
  connections = []
})
afterEach(() => {
  repositories.forEach((repository) => repository.close())
  connections.forEach((connection) => connection.close())
  vi.unstubAllGlobals()
})

function repository() {
  const result = createProgressRepository({ factory })
  repositories.push(result)
  return result
}

function rawDatabase(version = 1, upgrade?: (db: globalThis.IDBDatabase) => void): Promise<globalThis.IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open('sqlflashcards', version)
    request.onupgradeneeded = () => upgrade?.(request.result)
    request.onerror = () => reject(request.error ?? new Error('Open failed'))
    request.onblocked = () => reject(new Error('Unexpected blocked upgrade'))
    request.onsuccess = () => { connections.push(request.result); resolve(request.result) }
  })
}

function writeRaw(db: globalThis.IDBDatabase, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('topicProgress', 'readwrite')
    transaction.objectStore('topicProgress').put(value)
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error('Write aborted'))
  })
}

function readRaw(db: globalThis.IDBDatabase): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('topicProgress')
    const request = transaction.objectStore('topicProgress').getAll()
    transaction.oncomplete = () => resolve(request.result as unknown[])
    transaction.onabort = () => reject(transaction.error ?? new Error('Read aborted'))
  })
}

describe('IndexedDB topic progress', () => {
  it('creates only the first-stage store and persists complete and incomplete states across connections', async () => {
    const first = repository()
    expect(await first.getAll()).toEqual([])
    expect(await first.setTopicCovered({ topicId: 'joins', covered: true, changedAt: firstTime, expectedVersion: 0 }))
      .toEqual({ kind: 'saved', progress: example })
    first.close()
    const reopened = repository()
    expect(await reopened.getAll()).toEqual([example])
    expect(await reopened.setTopicCovered({ topicId: 'joins', covered: false, changedAt: laterTime, expectedVersion: 1 }))
      .toMatchObject({ kind: 'saved', progress: { covered: false, coveredAt: null, updatedAt: laterTime, version: 2 } })
    reopened.close()
    expect(await repository().getAll()).toEqual([{ ...example, covered: false, coveredAt: null, updatedAt: laterTime, version: 2 }])
    const db = await rawDatabase()
    expect([...db.objectStoreNames]).toEqual(['topicProgress'])
    expect(db.version).toBe(1)
  })

  it('retains records without relying on the active content catalogue', async () => {
    const repo = repository()
    await repo.setTopicCovered({ topicId: 'retired-topic', covered: true, changedAt: firstTime, expectedVersion: 0 })
    expect(await repo.getAll()).toEqual([{ ...example, topicId: 'retired-topic' }])
  })

  it('serializes concurrent writes and rejects a stale tab without overwriting the winner', async () => {
    const one = repository()
    const two = repository()
    await Promise.all([one.getAll(), two.getAll()])
    const results = await Promise.all([
      one.setTopicCovered({ topicId: 'joins', covered: true, changedAt: firstTime, expectedVersion: 0 }),
      two.setTopicCovered({ topicId: 'joins', covered: false, changedAt: laterTime, expectedVersion: 0 }),
    ])
    expect(results.map((result) => result.kind).sort()).toEqual(['saved', 'stale'])
    const saved = results.find((result) => result.kind === 'saved')
    const stale = results.find((result) => result.kind === 'stale')
    expect(stale?.current).toEqual(saved?.progress)
    expect(await one.getAll()).toEqual([saved?.progress])
  })

  it('returns a missing-record stale result and permits an explicit retry with the new version', async () => {
    const repo = repository()
    expect(await repo.setTopicCovered({ topicId: 'joins', covered: true, changedAt: firstTime, expectedVersion: 9 }))
      .toEqual({ kind: 'stale', current: null })
    await repo.setTopicCovered({ topicId: 'joins', covered: true, changedAt: firstTime, expectedVersion: 0 })
    expect(await repo.setTopicCovered({ topicId: 'joins', covered: false, changedAt: laterTime, expectedVersion: 0 }))
      .toEqual({ kind: 'stale', current: example })
    expect(await repo.setTopicCovered({ topicId: 'joins', covered: false, changedAt: laterTime, expectedVersion: 1 }))
      .toMatchObject({ kind: 'saved', progress: { version: 2, covered: false } })
  })

  it('never reports success if the transaction aborts after the put request succeeds', async () => {
    const repo = repository()
    await repo.getAll()
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Called with the original store through apply below.
    const original = IDBObjectStore.prototype.put
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(function (this: globalThis.IDBObjectStore, ...args) {
      const request = original.apply(this, args)
      request.onsuccess = () => this.transaction.abort()
      return request
    })
    await expect(repo.setTopicCovered({ topicId: 'joins', covered: true, changedAt: firstTime, expectedVersion: 0 }))
      .rejects.toMatchObject({ code: 'aborted' })
    expect(await repo.getAll()).toEqual([])
  })

  it('classifies quota failure, keeps the old value, and succeeds on retry', async () => {
    const repo = repository()
    await repo.setTopicCovered({ topicId: 'joins', covered: true, changedAt: firstTime, expectedVersion: 0 })
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => { throw new DOMException('Full', 'QuotaExceededError') })
    const change = { topicId: 'joins', covered: false, changedAt: laterTime, expectedVersion: 1 }
    await expect(repo.setTopicCovered(change)).rejects.toMatchObject({ code: 'quota' })
    expect(await repo.getAll()).toEqual([example])
    await expect(repo.setTopicCovered(change)).resolves.toMatchObject({ kind: 'saved', progress: { covered: false, version: 2 } })
  })

  it.each([
    { ...example, version: 0 },
    { ...example, covered: false },
    { ...example, coveredAt: null },
    { ...example, updatedAt: '2026-02-31T08:00:00.000Z' },
  ])('preserves unreadable records and refuses to overwrite them (%j)', async (invalid) => {
    const repo = repository()
    await repo.getAll()
    const db = await rawDatabase()
    await writeRaw(db, invalid)
    await expect(repo.getAll()).rejects.toMatchObject({ code: 'corrupt' })
    await expect(repo.setTopicCovered({ topicId: 'joins', covered: false, changedAt: laterTime, expectedVersion: 0 }))
      .rejects.toMatchObject({ code: 'corrupt' })
    expect(await readRaw(db)).toEqual([invalid])
  })

  it('rejects invalid commands before opening storage', async () => {
    const open = vi.spyOn(factory, 'open')
    await expect(repository().setTopicCovered({ topicId: 'joins', covered: true, changedAt: 'not a time', expectedVersion: 0 }))
      .rejects.toThrow('Invalid topic progress change')
    expect(open).not.toHaveBeenCalled()
  })

  it('reports unavailable storage and allows another attempt', async () => {
    vi.stubGlobal('indexedDB', undefined)
    const absent = createProgressRepository()
    await expect(absent.getAll()).rejects.toMatchObject({ code: 'unavailable' })
    const repo = repository()
    vi.spyOn(factory, 'open').mockImplementationOnce(() => { throw new DOMException('Denied', 'SecurityError') })
    await expect(repo.getAll()).rejects.toMatchObject({ code: 'unavailable' })
    await expect(repo.getAll()).resolves.toEqual([])
  })

  it('closes on versionchange so a newer app can upgrade and refuses to downgrade that database', async () => {
    const repo = repository()
    await repo.setTopicCovered({ topicId: 'joins', covered: true, changedAt: firstTime, expectedVersion: 0 })
    const upgraded = await rawDatabase(2)
    upgraded.close()
    await expect(repo.getAll()).rejects.toMatchObject({ code: 'migration' })
    expect(await readRaw(await rawDatabase(2))).toEqual([example])
  })

  it('preserves an incompatible existing schema instead of resetting it', async () => {
    const incompatible = await rawDatabase(1, (db) => { db.createObjectStore('original-data') })
    incompatible.close()
    await expect(repository().getAll()).rejects.toMatchObject({ code: 'migration' })
    expect([...(await rawDatabase()).objectStoreNames]).toEqual(['original-data'])
  })

  it('rolls back failed schema initialization and permits retry', async () => {
    vi.spyOn(IDBDatabase.prototype, 'createObjectStore').mockImplementationOnce(() => { throw new Error('Simulated migration failure') })
    const repo = repository()
    await expect(repo.getAll()).rejects.toMatchObject({ code: 'migration' })
    await expect(repo.getAll()).resolves.toEqual([])
  })

  it('cancels an open during cleanup without retaining a connection, and can reopen', async () => {
    const repo = repository()
    const loading = repo.getAll()
    repo.close()
    await expect(loading).rejects.toMatchObject({ code: 'aborted' })
    await expect(repo.getAll()).resolves.toEqual([])
    repo.close()
    await expect(rawDatabase(2)).resolves.toHaveProperty('version', 2)
  })

  it('reports a blocked open and abandons its delayed migration before retrying', async () => {
    const open = factory.open.bind(factory)
    let finished: Promise<void> | undefined
    vi.spyOn(factory, 'open').mockImplementationOnce((...args) => {
      const request = open(...args)
      finished = new Promise((resolve) => { request.addEventListener('error', () => resolve()) })
      queueMicrotask(() => request.dispatchEvent(new IDBVersionChangeEvent('blocked', { oldVersion: 0, newVersion: 1 })))
      return request
    })
    const repo = repository()
    await expect(repo.getAll()).rejects.toMatchObject({ code: 'blocked' })
    await finished
    await expect(repo.getAll()).resolves.toEqual([])
  })

  it('closes a delayed successful connection from an abandoned blocked attempt', async () => {
    const repo = repository()
    await repo.getAll()
    repo.close()
    const open = factory.open.bind(factory)
    let finished: Promise<void> | undefined
    vi.spyOn(factory, 'open').mockImplementationOnce((...args) => {
      const request = open(...args)
      finished = new Promise((resolve) => { request.addEventListener('success', () => resolve()) })
      queueMicrotask(() => request.dispatchEvent(new IDBVersionChangeEvent('blocked', { oldVersion: 0, newVersion: 1 })))
      return request
    })
    await expect(repo.getAll()).rejects.toMatchObject({ code: 'blocked' })
    await finished
    await expect(rawDatabase(2)).resolves.toHaveProperty('version', 2)
  })
})
