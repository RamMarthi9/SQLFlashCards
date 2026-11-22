import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import { createServer } from 'vite'

// One terminal owns both processes. Closing it stops the API and Vite together.
const build = spawn(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.server-build.json'], { stdio: 'inherit', windowsHide: true })
const [buildCode] = await once(build, 'exit')
if (buildCode !== 0) process.exit(buildCode ?? 1)

const apiPort = process.env.API_PORT ?? '3001'
const origin = 'http://127.0.0.1:5173'
const api = spawn(process.execPath, ['dist-server/server/main.js'], {
  stdio: 'inherit', windowsHide: true,
  env: { ...process.env, HOST: '127.0.0.1', PORT: apiPort, APP_ORIGIN: origin },
})
let vite
let stopping = false
async function shutdown(code = 0) {
  if (stopping) return
  stopping = true
  await vite?.close()
  if (api.exitCode === null) {
    const exited = once(api, 'exit')
    api.kill('SIGTERM')
    await Promise.race([exited, delay(3000)])
  }
  process.exit(code)
}
process.on('SIGINT', () => { void shutdown() })
process.on('SIGTERM', () => { void shutdown() })
api.on('exit', (code) => { if (!stopping) void shutdown(code ?? 1) })
api.on('error', (error) => { console.error(error.message); void shutdown(1) })

try {
  let ready = false
  for (let attempt = 0; attempt < 100; attempt++) {
    if (api.exitCode !== null) throw new Error('The account server could not start.')
    try {
      const response = await fetch(`http://127.0.0.1:${apiPort}/api/session`, { signal: AbortSignal.timeout(500) })
      ready = response.ok
    } catch { /* The child is still starting. */ }
    if (ready) break
    await delay(100)
  }
  if (!ready) throw new Error('The account server did not become ready.')
  vite = await createServer()
  await vite.listen()
  vite.printUrls()
  console.log(`Accounts and learning progress are saved by the server. Open ${origin}`)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  await shutdown(1)
}
