import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { databaseEnvironment, queryDatabase } from './backup-process.mjs'

const objectsQuery = "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'"
const temporaryRoot = resolve(tmpdir())
const temporaryPrefix = 'sqlflashcards-backup-integration-'
let temporary
let stage = 'validating the disposable test databases'
try {
  if (!process.env.TEST_DATABASE_URL || !process.env.TEST_RESTORE_DATABASE_URL) throw new Error('Set TEST_DATABASE_URL and TEST_RESTORE_DATABASE_URL to two empty disposable PostgreSQL 17 databases.')
  process.env.NODE_ENV = 'test'
  process.env.BACKUP_TEST_ALLOW_INSECURE = '1'
  const source = databaseEnvironment(process.env.TEST_DATABASE_URL)
  const target = databaseEnvironment(process.env.TEST_RESTORE_DATABASE_URL)
  assert.notEqual(source.identity, target.identity, 'Test databases must be separate.')
  assert.equal(await queryDatabase(objectsQuery, source.env), '0', 'Backup test source must be empty.')
  assert.equal(await queryDatabase(objectsQuery, target.env), '0', 'Backup test target must be empty.')
  stage = 'seeding the test-only account fixture'
  await queryDatabase("CREATE SCHEMA sqlflashcards; CREATE TABLE sqlflashcards.accounts(id TEXT PRIMARY KEY, name TEXT NOT NULL); CREATE TABLE sqlflashcards.topic_progress(account_id TEXT REFERENCES sqlflashcards.accounts(id), topic_id TEXT NOT NULL, covered BOOLEAN NOT NULL, version BIGINT NOT NULL, PRIMARY KEY(account_id, topic_id)); INSERT INTO sqlflashcards.accounts VALUES ('fixture-a', 'Backup test learner A'), ('fixture-b', 'Backup test learner B'); INSERT INTO sqlflashcards.topic_progress VALUES ('fixture-a', 'basic-queries', true, 3), ('fixture-b', 'basic-queries', false, 1);", source.env)
  await queryDatabase("CREATE TABLE sqlflashcards.sessions(token_hash TEXT PRIMARY KEY, account_id TEXT REFERENCES sqlflashcards.accounts(id)); INSERT INTO sqlflashcards.sessions VALUES ('test-only-session-hash', 'fixture-a');", source.env)
  temporary = await mkdtemp(join(temporaryRoot, temporaryPrefix))
  const encrypted = join(temporary, 'backup.enc')
  const key = randomBytes(32).toString('base64')
  const childEnv = { ...process.env, BACKUP_DATABASE_URL: process.env.TEST_DATABASE_URL, RESTORE_DATABASE_URL: process.env.TEST_RESTORE_DATABASE_URL, RESTORE_DATABASE_NAME: target.databaseName, BACKUP_ENCRYPTION_KEY: key }
  async function execute(script, args, environment = childEnv) {
    const child = spawn(process.execPath, [script, ...args], { env: environment, stdio: 'ignore', windowsHide: true })
    return await new Promise((resolveProcess, reject) => { child.once('error', reject); child.once('close', resolveProcess) })
  }
  stage = 'creating the encrypted PostgreSQL dump'
  assert.equal(await execute('scripts/backup-database.mjs', ['--output', encrypted]), 0, 'Encrypted pg_dump failed.')
  assert.deepEqual(await readdir(temporary), ['backup.enc'], 'Backup must not write a plaintext dump.')
  assert.equal((await readFile(encrypted)).subarray(0, 8).toString(), 'SQLFCB01')
  stage = 'rejecting a wrong-key restore without changing the target'
  assert.equal(await execute('scripts/backup-restore.mjs', [encrypted, '--confirm-empty-target'], { ...childEnv, BACKUP_ENCRYPTION_KEY: randomBytes(32).toString('base64') }), 1, 'Wrong-key restore must fail.')
  assert.equal(await queryDatabase(objectsQuery, target.env), '0', 'Wrong-key restore must leave the target empty.')
  stage = 'restoring the authenticated backup into the empty target'
  assert.equal(await execute('scripts/backup-restore.mjs', [encrypted, '--confirm-empty-target']), 0, 'Authenticated restore failed.')
  stage = 'verifying restored account progress and empty sessions'
  assert.equal(await queryDatabase('SELECT count(*) FROM sqlflashcards.accounts', target.env), '2')
  assert.equal(await queryDatabase('SELECT count(*) FROM sqlflashcards.sessions', target.env), '0', 'Session table must be restored without old session hashes.')
  const rows = await queryDatabase("SELECT account_id, topic_id, covered, version FROM sqlflashcards.topic_progress ORDER BY account_id", target.env)
  assert.equal(rows, 'fixture-a|basic-queries|t|3\nfixture-b|basic-queries|f|1')
  stage = 'rejecting a restore over existing data'
  assert.equal(await execute('scripts/backup-restore.mjs', [encrypted, '--confirm-empty-target']), 1, 'Nonempty-target restore must fail.')
  assert.equal(await queryDatabase("SELECT account_id, topic_id, covered, version FROM sqlflashcards.topic_progress ORDER BY account_id", target.env), rows, 'Refused restore must preserve existing data.')
  console.log('PostgreSQL backup integration passed: encrypted dump, separate-account restore, wrong-key rejection, and nonempty-target protection.')
} catch {
  console.error(`PostgreSQL backup integration failed while ${stage}. Use two fresh disposable PostgreSQL 17 databases; no connection strings or database rows are logged.`)
  process.exitCode = 1
} finally {
  if (temporary) {
    const target = resolve(temporary)
    if (dirname(target) !== temporaryRoot || !basename(target).startsWith(temporaryPrefix) || basename(target).length <= temporaryPrefix.length) {
      console.error('Refusing cleanup outside the generated integration-test temporary directory.')
      process.exitCode = 1
    } else await rm(target, { recursive: true, force: true })
  }
}
