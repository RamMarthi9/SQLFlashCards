import { randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createAccountServer } from './app.js'

const production = process.argv.includes('--production') || process.env.NODE_ENV === 'production'
const preview = process.argv.includes('--preview')
const origin = process.env.APP_ORIGIN ?? (production ? '' : preview ? 'http://127.0.0.1:4173' : 'http://127.0.0.1:5173')
if (production && !origin.startsWith('https://')) throw new Error('Set APP_ORIGIN to the public HTTPS website origin.')
const dataDirectory = resolve(process.env.DATA_DIR ?? 'user-data')
await mkdir(dataDirectory, { recursive: true, mode: 0o700 })
let pepper = process.env.SQLFLASHCARDS_PIN_PEPPER
if (!pepper && !production) {
  const pepperPath = resolve(dataDirectory, 'pin-pepper')
  try { pepper = await readFile(pepperPath, 'utf8') }
  catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
    pepper = randomBytes(32).toString('hex')
    await writeFile(pepperPath, pepper, { flag: 'wx', mode: 0o600 })
  }
}
if (!pepper || pepper.length < 32) throw new Error('Set SQLFLASHCARDS_PIN_PEPPER to a stable secret of at least 32 random characters.')
const port = Number(process.env.PORT ?? (preview && !production ? 4173 : 3001))
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.')
const app = createAccountServer({ databasePath: resolve(dataDirectory, 'accounts.sqlite'), pepper, origin, secureCookies: production, ...(production || preview ? { staticDirectory: resolve('dist') } : {}), ...(process.env.TRUSTED_PROXY_IP ? { trustedProxyAddress: process.env.TRUSTED_PROXY_IP } : {}) })
app.server.listen(port, process.env.HOST ?? '127.0.0.1', () => { console.log(preview && !production ? `SQLFlashCards preview: ${origin}` : `SQLFlashCards account server listening on port ${port}.`) })
let stopping = false
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
  if (stopping) return
  stopping = true
  void app.close().catch(() => { process.exitCode = 1 })
})
