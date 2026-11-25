import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import test from 'node:test'
import { backupKey, decryptBackup, encryptBackup } from './backup-crypto.mjs'
import { databaseEnvironment } from './backup-process.mjs'

async function workspace(t) {
  const temporaryRoot = resolve(tmpdir())
  const temporaryPrefix = 'sqlflashcards-backup-test-'
  const directory = await mkdtemp(join(temporaryRoot, temporaryPrefix))
  t.after(async () => {
    const target = resolve(directory)
    if (dirname(target) !== temporaryRoot || !basename(target).startsWith(temporaryPrefix) || basename(target).length <= temporaryPrefix.length) throw new Error('Refusing cleanup outside the generated backup-test temporary directory.')
    await rm(target, { recursive: true, force: true })
  })
  return directory
}

test('authenticated backups round-trip binary and empty input with unique nonces', async (t) => {
  const directory = await workspace(t)
  const key = backupKey(randomBytes(32).toString('base64'))
  for (const [index, original] of [randomBytes(128_003), Buffer.alloc(0)].entries()) {
    const first = join(directory, `${index}.enc`)
    const second = join(directory, `${index}-second.enc`)
    const restored = join(directory, `${index}.dump`)
    await encryptBackup(Readable.from([original]), first, key)
    await encryptBackup(Readable.from([original]), second, key)
    assert.notDeepEqual(await readFile(first), await readFile(second))
    await decryptBackup(first, restored, key)
    assert.deepEqual(await readFile(restored), original)
  }
})

test('wrong keys, tampering, truncation, and unsupported formats leave no plaintext or partial files', async (t) => {
  const directory = await workspace(t)
  const key = randomBytes(32)
  const source = join(directory, 'original.enc')
  await encryptBackup(Readable.from([randomBytes(6000)]), source, key)
  const bytes = await readFile(source)
  const cases = [{ bytes, key: randomBytes(32) }]
  for (const position of [0, 9, 25, bytes.length - 1]) {
    const modified = Buffer.from(bytes)
    modified[position] ^= 1
    cases.push({ bytes: modified, key })
  }
  cases.push({ bytes: bytes.subarray(0, 10), key }, { bytes: bytes.subarray(0, bytes.length - 1), key })
  for (const [index, specimen] of cases.entries()) {
    const file = join(directory, `bad-${index}.enc`)
    await writeFile(file, specimen.bytes)
    await assert.rejects(decryptBackup(file, join(directory, `bad-${index}.dump`), specimen.key))
  }
  assert.equal((await readdir(directory)).some((file) => file.endsWith('.dump') || file.endsWith('.partial')), false)
})

test('backup operations preserve existing output files and remove failed encryption output', async (t) => {
  const directory = await workspace(t)
  const key = randomBytes(32)
  const occupied = join(directory, 'existing')
  await writeFile(occupied, 'keep this file')
  await assert.rejects(encryptBackup(Readable.from(['new data']), occupied, key))
  assert.equal(await readFile(occupied, 'utf8'), 'keep this file')
  const encrypted = join(directory, 'good.enc')
  await encryptBackup(Readable.from(['new data']), encrypted, key)
  await assert.rejects(decryptBackup(encrypted, occupied, key))
  assert.equal(await readFile(occupied, 'utf8'), 'keep this file')
  const failingSource = Readable.from((async function* () { yield Buffer.from('partial data'); throw new Error('Source failed') })())
  const failed = join(directory, 'failed.enc')
  await assert.rejects(encryptBackup(failingSource, failed, key))
  assert.equal((await readdir(directory)).includes('failed.enc'), false)
  assert.equal((await readdir(directory)).some((file) => file.endsWith('.partial')), false)
})

test('backup keys are canonical base64 encoding exactly 32 bytes', () => {
  for (const invalid of ['', 'a'.repeat(32), randomBytes(31).toString('base64'), randomBytes(33).toString('base64'), '!!!!']) assert.throws(() => backupKey(invalid))
  const encoded = randomBytes(32).toString('base64')
  assert.equal(backupKey(encoded).toString('base64'), encoded)
})

test('database connection validation requires TLS and keeps credentials in child environment', () => {
  assert.throws(() => databaseEnvironment('not a connection'))
  assert.throws(() => databaseEnvironment('postgresql://reader:secret@db.example/test?sslmode=disable'))
  const { env, databaseName } = databaseEnvironment('postgresql://reader:p%40ss@db.example:6432/learning?sslmode=require&channel_binding=require')
  assert.equal(databaseName, 'learning')
  assert.equal(env.PGPASSWORD, 'p@ss')
  assert.equal(env.PGHOST, 'db.example')
  assert.equal(env.PGPORT, '6432')
  assert.equal(env.PGSSLMODE, 'require')
  assert.equal(env.PGCHANNELBINDING, 'require')
  assert.equal(env.BACKUP_ENCRYPTION_KEY, undefined)
  assert.equal(env.SQLFLASHCARDS_PIN_PEPPER, undefined)
})
