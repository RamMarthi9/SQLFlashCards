import type { IncomingMessage, ServerResponse } from 'node:http'
import { isIP } from 'node:net'
import { createAccountHandler } from './handler.js'
import { PostgresAccountStore } from './postgresStore.js'

export function vercelConfiguration(environment: NodeJS.ProcessEnv) {
  if (environment.VERCEL !== '1') throw new Error('This entry point must run behind Vercel.')
  if (environment.VERCEL_ENV !== 'production') throw new Error('Account API is disabled on preview deployments.')
  const origin = environment.APP_ORIGIN ?? ''
  const parsed = new URL(origin)
  if (parsed.protocol !== 'https:' || parsed.origin !== origin) throw new Error('Set APP_ORIGIN to the exact production HTTPS origin.')
  const databaseUrl = environment.DATABASE_URL
  const pepper = environment.SQLFLASHCARDS_PIN_PEPPER
  if (!databaseUrl || !pepper || pepper.length < 32) throw new Error('Configure the private production database and PIN pepper.')
  if (environment.NODEJS_HELPERS !== '0') throw new Error('Set NODEJS_HELPERS=0 to preserve bounded raw request parsing.')
  return { origin, databaseUrl, pepper }
}

export function vercelClientAddress(request: IncomingMessage) {
  // Only this Vercel-only entry point trusts the header overwritten by its edge.
  const address = request.headers['x-vercel-forwarded-for']
  if (typeof address !== 'string' || !isIP(address.trim())) return 'unknown-vercel-client'
  const value = address.trim()
  return value.startsWith('::ffff:') && isIP(value.slice(7)) === 4 ? value.slice(7) : value
}

let pendingHandler: Promise<ReturnType<typeof createAccountHandler>> | undefined
async function initialize() {
  const { origin, databaseUrl, pepper } = vercelConfiguration(process.env)
  const store = await PostgresAccountStore.open(databaseUrl, pepper)
  try {
    return createAccountHandler({ origin, store, secureCookies: true, clientAddress: vercelClientAddress })
  } catch (error) { await store.close(); throw error }
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  try {
    // Share cold-start initialization; a failed initialization can be retried.
    pendingHandler ??= initialize().catch((error: unknown) => { pendingHandler = undefined; throw error })
    const handle = await pendingHandler
    await handle(request, response)
  } catch {
    // Never log connection strings, PINs, or database errors to hosted logs.
    response.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '30' })
    response.end(JSON.stringify({ error: { code: 'service_unavailable', message: 'The account service is unavailable. Please try again shortly.' } }))
  }
}
