import { createServer } from 'node:http'
import { AccountStore } from './accountStore.js'
import { createAccountHandler, type AccountHandlerOptions } from './handler.js'

export interface AccountServerOptions extends Omit<AccountHandlerOptions, 'store'> {
  databasePath: string
  pepper: string
  now?: () => number
}

/** Local development/standalone SQLite host. Vercel uses the handler directly. */
export function createAccountServer(options: AccountServerOptions) {
  const store = new AccountStore(options.databasePath, options.pepper, options.now ?? Date.now)
  let handler: ReturnType<typeof createAccountHandler>
  try { handler = createAccountHandler({ ...options, store }) }
  catch (error) { store.close(); throw error }
  const server = createServer((request, response) => { void handler(request, response) })
  server.requestTimeout = 15_000
  server.headersTimeout = 10_000
  return {
    server,
    async close() {
      if (server.listening) await new Promise<void>((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()))
      store.close()
    },
  }
}
