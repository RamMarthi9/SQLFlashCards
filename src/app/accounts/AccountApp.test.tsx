import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { TopicProgress } from '../../domain/progress'
import { createProgressRepository } from '../../storage/indexedDbProgress'
import { getSession, type Account } from '../../storage/httpProgress'
import App from '../App'

const alice: Account = { id: 'account-alice', name: 'Alice' }
const bob: Account = { id: 'account-bob', name: 'Bob' }
const instant = '2026-11-22T12:00:00.000Z'
let signedIn: Account | null
let saved: Map<string, TopicProgress[]>
let failSession: boolean
let failSave: boolean
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

function response(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } }) }
function record(topicId: string, covered: boolean, version = 1): TopicProgress { return { topicId, covered, version, coveredAt: covered ? instant : null, updatedAt: instant } }

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  signedIn = null
  saved = new Map([[alice.id, []], [bob.id, []]])
  failSession = false
  failSave = false
  vi.stubGlobal('indexedDB', new IDBFactory())
  fetchMock = vi.fn<typeof fetch>().mockImplementation((input, init) => {
    const path = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const headers = new Headers(init?.headers)
    if (path === '/api/session') return failSession ? Promise.reject(new Error('offline')) : Promise.resolve(response({ account: signedIn }))
    if (path === '/api/login' || path === '/api/signup') {
      const body = JSON.parse(init?.body as string) as { name: string; pin: string }
      signedIn = body.name.toLowerCase() === 'bob' ? bob : alice
      return Promise.resolve(response({ account: signedIn }))
    }
    if (path === '/api/logout') { signedIn = null; return Promise.resolve(response({})) }
    if (!signedIn) return Promise.resolve(response({ error: { code: 'unauthorized', message: 'Please sign in.' } }, 401))
    if (headers.get('X-Account-ID') !== signedIn.id) return Promise.resolve(response({ error: { code: 'account_changed', message: 'Your account changed.' } }, 409))
    if (path === '/api/progress') return Promise.resolve(response({ accountId: signedIn.id, progress: saved.get(signedIn.id) ?? [] }))
    if (path.startsWith('/api/progress/')) {
      if (failSave) return Promise.resolve(response({ error: { code: 'unavailable', message: 'Progress could not be saved.' } }, 503))
      const body = JSON.parse(init?.body as string) as { covered: boolean; expectedVersion: number }
      const topicId = path.split('/').at(-1)!
      const current = saved.get(signedIn.id) ?? []
      const previous = current.find((item) => item.topicId === topicId)
      if ((previous?.version ?? 0) !== body.expectedVersion) return Promise.resolve(response({ kind: 'stale', current: previous ?? null }))
      const progress = record(topicId, body.covered, body.expectedVersion + 1)
      saved.set(signedIn.id, [...current.filter((item) => item.topicId !== topicId), progress])
      return Promise.resolve(response({ kind: 'saved', progress }))
    }
    return Promise.resolve(response({ error: { code: 'missing', message: 'Missing route.' } }, 404))
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => { vi.unstubAllGlobals() })

async function signIn(name: string, pin = '0123') {
  fireEvent.click(await screen.findByRole('button', { name: 'Sign in' }))
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: name } })
  fireEvent.change(screen.getByLabelText('4-digit PIN'), { target: { value: pin } })
  fireEvent.click(screen.getByRole('button', { name: 'Continue learning' }))
  await screen.findByText(name, { selector: 'strong' })
}

async function ready(name = 'Mark Basic queries completed') {
  const button = await screen.findByRole('button', { name })
  await waitFor(() => expect(button).toBeEnabled())
  return button
}

test('sign-up needs only a name and four-digit PIN and preserves a leading zero', async () => {
  render(<App />)
  await screen.findByRole('button', { name: 'Create account' })
  expect(document.querySelectorAll('.account-form input')).toHaveLength(2)
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alice' } })
  fireEvent.change(screen.getByLabelText('4-digit PIN'), { target: { value: '0123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
  await ready()
  const signup = fetchMock.mock.calls.find(([path]) => path === '/api/signup')!
  expect(JSON.parse(signup[1]?.body as string)).toEqual({ name: 'Alice', pin: '0123' })
  expect(new Headers(signup[1]?.headers).get('X-SQLFlashCards-Request')).toBe('1')
  expect(signup[1]?.credentials).toBe('same-origin')
  expect(screen.queryByLabelText('4-digit PIN')).not.toBeInTheDocument()
})

test('rejects a PIN that is not exactly four digits without submitting credentials', async () => {
  render(<App />)
  await screen.findByRole('button', { name: 'Create account' })
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alice' } })
  fireEvent.change(screen.getByLabelText('4-digit PIN'), { target: { value: '1a34' } })
  fireEvent.submit(document.querySelector('form')!)
  expect(screen.getByRole('alert')).toHaveTextContent('Enter exactly four digits')
  expect(fetchMock.mock.calls.some(([path]) => path === '/api/signup')).toBe(false)
})

test('loads the server session and restores saved account progress after remount', async () => {
  signedIn = alice
  saved.set(alice.id, [record('basic-queries', true)])
  const view = render(<App />)
  await ready('Mark Basic queries incomplete')
  expect(screen.getByText('1 of 14 topics completed')).toBeVisible()
  view.unmount()
  render(<App />)
  await ready('Mark Basic queries incomplete')
  expect(screen.getByText('1 of 14 topics completed')).toBeVisible()
})

test('sign-out hides progress and signing into another account keeps records separate', async () => {
  signedIn = alice
  saved.set(alice.id, [record('basic-queries', true)])
  render(<App />)
  await ready('Mark Basic queries incomplete')
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
  await signIn('Bob')
  fireEvent.click(await ready('Mark Filtering and missing values completed'))
  await ready('Mark Filtering and missing values incomplete')
  expect(screen.getByText('1 of 14 topics completed')).toBeVisible()
  expect(saved.get(alice.id)).toEqual([record('basic-queries', true)])
  expect(saved.get(bob.id)).toEqual([record('filtering', true)])
  const logout = fetchMock.mock.calls.find(([path]) => path === '/api/logout')!
  expect(new Headers(logout[1]?.headers).get('X-Account-ID')).toBe(alice.id)
})

test('a failed server save keeps confirmed state and can retry without browser fallback', async () => {
  signedIn = alice
  failSave = true
  render(<App />)
  fireEvent.click(await ready())
  const retry = await screen.findByRole('button', { name: 'Retry save' })
  expect(screen.getByText('0 of 14 topics completed')).toBeVisible()
  failSave = false
  fireEvent.click(retry)
  await ready('Mark Basic queries incomplete')
  expect(screen.getByRole('status')).toHaveTextContent('Saved to your account')
  const local = createProgressRepository()
  expect(await local.getAll()).toEqual([])
  local.close()
})

test('expired sessions clear account progress instead of showing another person’s records', async () => {
  signedIn = alice
  saved.set(alice.id, [record('basic-queries', true)])
  render(<App />)
  await ready('Mark Basic queries incomplete')
  signedIn = null
  fireEvent.click(screen.getByRole('button', { name: 'Mark Basic queries incomplete' }))
  await screen.findByRole('button', { name: 'Create account' })
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Your session ended')
})

test('a failed session refresh hides prior progress until the account can be verified', async () => {
  signedIn = alice
  saved.set(alice.id, [record('basic-queries', true)])
  render(<App />)
  await ready('Mark Basic queries incomplete')
  failSession = true
  fireEvent(window, new Event('focus'))
  const retry = await screen.findByRole('button', { name: 'Retry connection' })
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
  failSession = false
  signedIn = bob
  fireEvent.click(retry)
  await ready()
  expect(screen.getByText('Bob', { selector: 'strong' })).toBeVisible()
  expect(screen.getByText('0 of 14 topics completed')).toBeVisible()
})

test('an old account save response cannot update the newly selected account', async () => {
  signedIn = alice
  render(<App />)
  await ready()
  let finish: ((value: Response) => void) | undefined
  fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve }))
  fireEvent.click(screen.getByRole('button', { name: 'Mark Basic queries completed' }))
  signedIn = bob
  fireEvent(window, new Event('focus'))
  await screen.findByText('Bob', { selector: 'strong' })
  await ready()
  await act(() => { finish!(response({ kind: 'saved', progress: record('basic-queries', true) })); return Promise.resolve() })
  expect(screen.getByText('0 of 14 topics completed')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Mark Basic queries completed' })).toBeEnabled()
})

test('an account guard rejects a save after another tab signs in as someone else', async () => {
  signedIn = alice
  render(<App />)
  await ready()
  signedIn = bob
  fireEvent.click(screen.getByRole('button', { name: 'Mark Basic queries completed' }))
  await screen.findByRole('button', { name: 'Create account' })
  expect(saved.get(alice.id)).toEqual([])
  expect(saved.get(bob.id)).toEqual([])
})

test('imports only explicitly claimed browser records without overwriting account progress', async () => {
  signedIn = alice
  saved.set(alice.id, [record('basic-queries', false)])
  const local = createProgressRepository()
  await local.setTopicCovered({ topicId: 'basic-queries', covered: true, expectedVersion: 0, changedAt: instant })
  await local.setTopicCovered({ topicId: 'filtering', covered: true, expectedVersion: 0, changedAt: instant })
  local.close()
  render(<App />)
  await ready()
  fireEvent.click(screen.getByText('Bring over progress from the earlier app'))
  expect(screen.getByRole('button', { name: 'Import browser progress' })).toBeDisabled()
  expect(saved.get(alice.id)).toEqual([record('basic-queries', false)])
  fireEvent.click(screen.getByLabelText('These browser-saved topics are mine'))
  fireEvent.click(screen.getByRole('button', { name: 'Import browser progress' }))
  await screen.findByText('Imported 1 topic. Existing account progress and the browser copy were kept.')
  await ready('Mark Filtering and missing values incomplete')
  expect(screen.getByRole('button', { name: 'Mark Basic queries completed' })).toBeEnabled()
  const preserved = createProgressRepository()
  expect(await preserved.getAll()).toHaveLength(2)
  preserved.close()
})

test('sign-out failure hides the old account and provides a guarded retry', async () => {
  signedIn = alice
  render(<App />)
  await ready()
  fetchMock.mockRejectedValueOnce(new Error('offline'))
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
  const retry = await screen.findByRole('button', { name: 'Retry sign out' })
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
  fireEvent.click(retry)
  await screen.findByRole('button', { name: 'Create account' })
  expect(signedIn).toBeNull()
})

test('a throttled sign-in shows the service message and clears the submitted PIN', async () => {
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Sign in' }))
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alice' } })
  fireEvent.change(screen.getByLabelText('4-digit PIN'), { target: { value: '0123' } })
  fetchMock.mockResolvedValueOnce(response({ error: { code: 'rate_limited', message: 'Too many attempts. Try again later.' } }, 429))
  fireEvent.click(screen.getByRole('button', { name: 'Continue learning' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts. Try again later.')
  expect(screen.getByLabelText('4-digit PIN')).toHaveValue('')
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
})

test('a stalled account request times out instead of waiting indefinitely', async () => {
  vi.useFakeTimers()
  try {
    fetchMock.mockImplementation((_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    }))
    const pending = expect(getSession()).rejects.toThrow('Could not reach the account service')
    await vi.advanceTimersByTimeAsync(15_000)
    await pending
  } finally { vi.useRealTimers() }
})
