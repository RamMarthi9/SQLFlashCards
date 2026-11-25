import { rm } from 'node:fs/promises'
import { backupKey, encryptBackup } from './backup-crypto.mjs'
import { databaseEnvironment, postgresProcess } from './backup-process.mjs'

let created = false
let output
let child
try {
  const [flag, destination, extra] = process.argv.slice(2)
  if (flag !== '--output' || !destination || extra) throw new Error('Usage: node scripts/backup-database.mjs --output <new-encrypted-file>')
  output = destination
  const key = backupKey()
  const { env } = databaseEnvironment(process.env.BACKUP_DATABASE_URL)
  const job = postgresProcess('pg_dump', ['--no-password', '--format=custom', '--schema=sqlflashcards', '--exclude-table-data=sqlflashcards.sessions', '--no-owner', '--no-acl'], env)
  child = job.child
  child.stdin.end()
  await encryptBackup(child.stdout, output, key)
  created = true
  await job.completion
  console.log('Encrypted database backup created. No plaintext dump was written.')
} catch {
  child?.kill()
  if (created && output) await rm(output, { force: true })
  console.error('Database backup failed. Check the database connection, PostgreSQL client version, encryption key, and new output path.')
  process.exitCode = 1
}
