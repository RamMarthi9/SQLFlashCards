import { createReadStream } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { backupKey, decryptBackup } from './backup-crypto.mjs'
import { databaseEnvironment, postgresProcess, queryDatabase } from './backup-process.mjs'

const temporaryRoot = resolve(tmpdir())
const temporaryPrefix = 'sqlflashcards-restore-'
let temporary
let child
try {
  const [source, confirmation, extra] = process.argv.slice(2)
  if (!source || confirmation !== '--confirm-empty-target' || extra) throw new Error('Supply an encrypted backup and --confirm-empty-target.')
  const key = backupKey()
  const target = databaseEnvironment(process.env.RESTORE_DATABASE_URL, { allowLoopback: true })
  if (!process.env.RESTORE_DATABASE_NAME || target.databaseName !== process.env.RESTORE_DATABASE_NAME) throw new Error('RESTORE_DATABASE_NAME must explicitly match the empty target database.')
  if (process.env.BACKUP_DATABASE_URL && databaseEnvironment(process.env.BACKUP_DATABASE_URL).identity === target.identity) throw new Error('The restore target cannot be the backup source.')
  const database = await queryDatabase('SELECT current_database()', target.env)
  if (database !== target.databaseName) throw new Error('The connected database differs from the explicit restore target.')
  const objects = await queryDatabase("SELECT (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema') + (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema')", target.env)
  if (objects !== '0') throw new Error('Restore requires a fresh database with no user tables, views, sequences, or functions.')
  temporary = await mkdtemp(join(temporaryRoot, temporaryPrefix))
  const dump = join(temporary, 'authenticated.dump')
  await decryptBackup(source, dump, key)
  const job = postgresProcess('pg_restore', ['--no-password', '--exit-on-error', '--single-transaction', '--no-owner', '--no-acl', '--dbname', target.databaseName], target.env)
  child = job.child
  child.stdout.resume()
  // All host and credential fields come from libpq environment variables, never command arguments.
  await pipeline(createReadStream(dump), child.stdin)
  await job.completion
  console.log('Backup restored into the explicitly selected empty database. The original database was not changed.')
} catch {
  child?.kill()
  console.error('Restore failed. Check the encrypted backup/key, explicit empty target, TLS connection, and PostgreSQL client version. No existing tables were deleted.')
  process.exitCode = 1
} finally {
  if (temporary) {
    const target = resolve(temporary)
    if (dirname(target) !== temporaryRoot || !basename(target).startsWith(temporaryPrefix) || basename(target).length <= temporaryPrefix.length) {
      console.error('Refusing cleanup outside the generated restore temporary directory.')
      process.exitCode = 1
    } else await rm(target, { recursive: true, force: true })
  }
}
