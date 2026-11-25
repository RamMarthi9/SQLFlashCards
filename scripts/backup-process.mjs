import { spawn } from 'node:child_process'

export function databaseEnvironment(value, { allowLoopback = false } = {}) {
  let url
  try { url = new URL(value) } catch { throw new Error('Provide a valid PostgreSQL connection URL in the required environment variable.') }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username || !url.pathname.slice(1)) throw new Error('Provide a complete PostgreSQL connection URL.')
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  const insecureTest = process.env.NODE_ENV === 'test' && process.env.BACKUP_TEST_ALLOW_INSECURE === '1' && ['localhost', '127.0.0.1', '[::1]', 'postgres'].includes(url.hostname)
  if ((!local || !allowLoopback) && !insecureTest) {
    if (!['require', 'verify-ca', 'verify-full'].includes(url.searchParams.get('sslmode'))) throw new Error('Remote backup and restore connections require TLS.')
  }
  // libpq receives connection fields only through the environment, never child command arguments.
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('PG')))
  Object.assign(env, {
    PGHOST: url.hostname.replace(/^\[|\]$/g, ''),
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGSSLMODE: url.searchParams.get('sslmode') || (local && allowLoopback ? 'disable' : 'require'),
    PGCHANNELBINDING: url.searchParams.get('channel_binding') || 'prefer',
    PGCONNECT_TIMEOUT: '20',
    PGAPPNAME: 'sqlflashcards-backup',
  })
  delete env.BACKUP_ENCRYPTION_KEY
  delete env.BACKUP_DATABASE_URL
  delete env.RESTORE_DATABASE_URL
  delete env.SQLFLASHCARDS_PIN_PEPPER
  return { env, databaseName: decodeURIComponent(url.pathname.slice(1)), identity: `${url.hostname}:${url.port || '5432'}${url.pathname}` }
}

export function postgresProcess(command, args, env) {
  const child = spawn(command, args, { env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
  // PostgreSQL errors can contain connection details or row data. Never forward them to CI logs.
  child.stderr.resume()
  const completion = new Promise((resolveProcess, reject) => {
    child.once('error', () => reject(new Error(`${command} could not start.`)))
    child.once('close', (code) => code === 0 ? resolveProcess() : reject(new Error(`${command} failed; no database details have been logged.`)))
  })
  // The caller may await a stream first. Register a handler now to avoid unhandled rejections.
  void completion.catch(() => {})
  return { child, completion }
}

export async function queryDatabase(sql, env) {
  const { child, completion } = postgresProcess('psql', ['-X', '--no-password', '--tuples-only', '--no-align', '--set', 'ON_ERROR_STOP=1', '--command', sql], env)
  child.stdin.end()
  const chunks = []
  let size = 0
  for await (const chunk of child.stdout) {
    size += chunk.length
    if (size > 4096) { child.kill(); throw new Error('Unexpected database validation response.') }
    chunks.push(chunk)
  }
  await completion
  return Buffer.concat(chunks).toString('utf8').trim()
}
