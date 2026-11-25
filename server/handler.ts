import type { IncomingMessage, ServerResponse } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { extname, resolve, relative, isAbsolute } from 'node:path'
import { isIP } from 'node:net'
import { ApiError, type AccountRepository } from './accountTypes.js'

interface TopicCatalog { topics: { id: string }[]; cards: { topicId: string }[] }
export interface AccountHandlerOptions {
  store: AccountRepository
  origin: string
  secureCookies?: boolean
  catalogPath?: string
  staticDirectory?: string
  trustedProxyAddress?: string
  clientAddress?: (request: IncomingMessage) => string
}

function normalizedIp(address: string) {
  return address.startsWith('::ffff:') && isIP(address.slice(7)) === 4 ? address.slice(7) : address
}
function clientAddress(request: IncomingMessage, trustedProxyAddress?: string) {
  const peer = normalizedIp(request.socket.remoteAddress ?? 'unknown')
  if (!trustedProxyAddress || peer !== normalizedIp(trustedProxyAddress)) return peer
  const header = request.headers['x-forwarded-for']
  const forwarded = typeof header === 'string' ? header.split(',').at(-1)?.trim() : undefined
  return forwarded && isIP(forwarded) ? normalizedIp(forwarded) : peer
}

const cookieName = 'sqlflashcards_session'
function tokenFrom(request: IncomingMessage): string | null {
  const cookie = request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1)
  return cookie && /^[A-Za-z0-9_-]{43}$/.test(cookie) ? cookie : null
}
function bodyFrom(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolveBody, reject) => {
    const parts: Buffer[] = []
    let size = 0
    let failed = false
    request.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > 4096) { failed = true; reject(new ApiError(413, 'too_large', 'The request is too large.')); return }
      if (!failed) parts.push(chunk)
    })
    request.on('end', () => {
      if (failed) return
      try {
        const value: unknown = JSON.parse(Buffer.concat(parts).toString('utf8'))
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object')
        resolveBody(value as Record<string, unknown>)
      } catch { reject(new ApiError(400, 'invalid_json', 'Send a valid JSON object.')) }
    })
    request.on('error', reject)
  })
}
function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(value))
}
function catalogFrom(path: string): TopicCatalog {
  const raw: unknown = JSON.parse(readFileSync(path, 'utf8'))
  if (!raw || typeof raw !== 'object' || !('topics' in raw) || !Array.isArray(raw.topics) || !('cards' in raw) || !Array.isArray(raw.cards)) throw new Error('Invalid server catalogue.')
  const ids = new Set<string>()
  for (const topic of raw.topics as unknown[]) {
    if (!topic || typeof topic !== 'object' || !('id' in topic) || typeof topic.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(topic.id) || ids.has(topic.id)) throw new Error('Invalid server topic.')
    ids.add(topic.id)
  }
  for (const card of raw.cards as unknown[]) {
    if (!card || typeof card !== 'object' || !('topicId' in card) || typeof card.topicId !== 'string' || !ids.has(card.topicId)) throw new Error('Invalid server card topic.')
  }
  return raw as TopicCatalog
}

export function createAccountHandler(options: AccountHandlerOptions) {
  const appOrigin = new URL(options.origin)
  if (appOrigin.origin !== options.origin || !['http:', 'https:'].includes(appOrigin.protocol)) throw new Error('APP_ORIGIN must be an HTTP(S) origin without a path.')
  if (options.secureCookies && appOrigin.protocol !== 'https:') throw new Error('Secure sessions require an HTTPS origin.')
  if (options.trustedProxyAddress && !isIP(options.trustedProxyAddress)) throw new Error('TRUSTED_PROXY_IP must be one exact IP address.')
  const catalog = catalogFrom(options.catalogPath ?? resolve('src/content/catalog.json'))
  const activeTopics = new Set(catalog.topics.map((topic) => topic.id))
  const populatedTopics = new Set(catalog.cards.map((card) => card.topicId))
  const store = options.store
  function setCookie(response: ServerResponse, token: string, clear = false) {
    response.setHeader('Set-Cookie', `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${clear ? 0 : 2_592_000}${options.secureCookies ? '; Secure' : ''}`)
  }
  async function route(request: IncomingMessage, response: ServerResponse) {
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('Referrer-Policy', 'no-referrer')
    response.setHeader('X-Frame-Options', 'DENY')
    const url = new URL(request.url ?? '/', options.origin)
    if (!url.pathname.startsWith('/api/')) {
      if (!options.staticDirectory || (request.method !== 'GET' && request.method !== 'HEAD')) throw new ApiError(404, 'not_found', 'Not found.')
      const root = resolve(options.staticDirectory)
      const path = resolve(root, `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`)
      const within = relative(root, path)
      if (within.startsWith('..') || isAbsolute(within)) throw new ApiError(404, 'not_found', 'Not found.')
      let file: Buffer
      try { if (!(await stat(path)).isFile()) throw new Error('Not a file'); file = await readFile(path) }
      catch { throw new ApiError(404, 'not_found', 'Not found.') }
      const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' }
      response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
      response.writeHead(200, { 'Content-Type': mime[extname(path)] ?? 'application/octet-stream', 'Cache-Control': url.pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' })
      response.end(request.method === 'HEAD' ? undefined : file)
      return
    }
    const mutable = request.method !== 'GET' && request.method !== 'HEAD'
    if (mutable && (request.headers.origin !== options.origin || request.headers['x-sqlflashcards-request'] !== '1' || request.headers['content-type']?.split(';')[0]?.trim() !== 'application/json')) throw new ApiError(403, 'request_rejected', 'This request could not be verified. Reload the website and try again.')
    const token = tokenFrom(request)
    if (request.method === 'GET' && url.pathname === '/api/session') { json(response, 200, { account: await store.session(token) }); return }
    if (request.method === 'POST' && (url.pathname === '/api/signup' || url.pathname === '/api/login')) {
      const body = await bodyFrom(request)
      // Only a configured socket peer may provide the final address appended by a trusted proxy.
      const ip = options.clientAddress ? options.clientAddress(request) : clientAddress(request, options.trustedProxyAddress)
      const account = url.pathname === '/api/signup' ? await store.signup(body, ip) : await store.login(body, ip)
      await store.logout(token)
      setCookie(response, await store.createSession(account))
      json(response, 200, { account })
      return
    }
    if (request.method === 'POST' && url.pathname === '/api/logout') {
      await bodyFrom(request)
      const current = await store.session(token)
      if (current && request.headers['x-account-id'] !== current.id) throw new ApiError(409, 'account_changed', 'The signed-in account has changed. Reload before signing out.')
      await store.logout(token)
      setCookie(response, '', true)
      json(response, 200, {})
      return
    }
    const account = await store.session(token)
    if (!account) throw new ApiError(401, 'unauthorized', 'Please sign in to load or save your progress.')
    if (request.headers['x-account-id'] !== account.id) throw new ApiError(409, 'account_changed', 'The signed-in account has changed. Reload before saving progress.')
    if (request.method === 'GET' && url.pathname === '/api/progress') { json(response, 200, { accountId: account.id, progress: await store.getAll(account.id) }); return }
    const match = /^\/api\/progress\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(url.pathname)
    const topicId = match?.[1]
    if (request.method === 'PUT' && topicId) {
      const body = await bodyFrom(request)
      if (typeof body.covered !== 'boolean' || typeof body.expectedVersion !== 'number' || !Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 0 || !activeTopics.has(topicId) || (body.covered && !populatedTopics.has(topicId))) throw new ApiError(400, 'invalid_progress', 'Choose an available topic and a valid completion change.')
      json(response, 200, await store.setCovered(account.id, topicId, body.covered, body.expectedVersion))
      return
    }
    throw new ApiError(404, 'not_found', 'Not found.')
  }
  return async (request: IncomingMessage, response: ServerResponse) => {
    await route(request, response).catch((error: unknown) => {
      const failure = error instanceof ApiError ? error : new ApiError(500, 'server_error', 'The server could not complete this request. Please try again.')
      if (failure.retryAfter !== undefined) response.setHeader('Retry-After', String(failure.retryAfter))
      if (!response.headersSent) json(response, failure.status, { error: { code: failure.code, message: failure.message } })
      else response.end()
    })
  }
}
