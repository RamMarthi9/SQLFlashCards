import { StrictMode } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { loadCatalog } from '../content/catalog'
import type { CoverageResult, ProgressRepository } from '../domain/progress'
import { createProgressRepository } from '../storage/indexedDbProgress'
import App from './App'

let factory: IDBFactory
let repositories: ProgressRepository[]

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  factory = new IDBFactory()
  repositories = []
})

afterEach(() => { repositories.forEach((repository) => repository.close()) })

function repository() {
  const result = createProgressRepository({ factory, databaseName: 'progress-ui-test' })
  repositories.push(result)
  return result
}

function navigate(hash: string) {
  act(() => {
    window.history.pushState(null, '', hash)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  })
}

async function readyButton(name = 'Mark Basic queries completed') {
  const button = await screen.findByRole('button', { name })
  await waitFor(() => expect(button).toBeEnabled())
  return button
}

async function setCovered(store: ProgressRepository, topicId: string, covered: boolean, expectedVersion: number) {
  return store.setTopicCovered({ topicId, covered, expectedVersion, changedAt: '2026-11-22T10:00:00.000Z' })
}

test('loads missing progress as incomplete without writing, including in StrictMode', async () => {
  const store = repository()
  const save = vi.spyOn(store, 'setTopicCovered')
  render(<StrictMode><App progressRepository={store} /></StrictMode>)
  await readyButton()
  expect(screen.getByText('0 of 14 topics completed')).toBeVisible()
  expect(screen.getByText('0% completed')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Incomplete (14)' })).toBeVisible()
  expect(screen.getAllByRole('article')).toHaveLength(14)
  for (const article of screen.getAllByRole('article')) {
    if (within(article).queryByText('Content coming soon')) {
      const complete = within(article).queryByRole('button', { name: /^Mark .* completed$/ })
      if (complete) expect(complete).toBeDisabled()
    }
  }
  expect(save).not.toHaveBeenCalled()
  expect(await store.getAll()).toEqual([])
})

test('completed and incomplete choices survive unmount and a fresh repository connection', async () => {
  let view = render(<App progressRepository={repository()} />)
  fireEvent.click(await readyButton())
  await readyButton('Mark Basic queries incomplete')
  expect(screen.getByText('1 of 14 topics completed')).toBeVisible()
  expect(screen.getByText('7% completed')).toBeVisible()
  view.unmount()

  view = render(<App progressRepository={repository()} />)
  fireEvent.click(await readyButton('Mark Basic queries incomplete'))
  await readyButton()
  expect(screen.getByText('0 of 14 topics completed')).toBeVisible()
  view.unmount()

  render(<App progressRepository={repository()} />)
  await readyButton()
  expect(screen.getByText('0 of 14 topics completed')).toBeVisible()
  expect(await repository().getAll()).toEqual([expect.objectContaining({ topicId: 'basic-queries', covered: false, version: 2 })])
})

test('filters completed and incomplete topics while keeping the overall count', async () => {
  render(<App progressRepository={repository()} />)
  fireEvent.click(await readyButton())
  await readyButton('Mark Basic queries incomplete')
  fireEvent.click(screen.getByRole('button', { name: 'Completed (1)' }))
  expect(screen.getByRole('button', { name: 'Completed (1)' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getAllByRole('article')).toHaveLength(1)
  expect(screen.getByRole('heading', { name: 'Basic queries' })).toBeVisible()
  expect(screen.getByText('1 of 14 topics completed')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Incomplete (13)' }))
  expect(screen.getAllByRole('article')).toHaveLength(13)
  expect(screen.queryByRole('heading', { name: 'Basic queries' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'All (14)' }))
  expect(screen.getAllByRole('article')).toHaveLength(14)
})

test('returns keyboard focus to the selected filter when a completion change removes the focused topic', async () => {
  const store = repository()
  await setCovered(store, 'basic-queries', true, 0)
  render(<App progressRepository={store} />)
  await readyButton('Mark Basic queries incomplete')
  fireEvent.click(screen.getByRole('button', { name: 'Completed (1)' }))
  const reopen = screen.getByRole('button', { name: 'Mark Basic queries incomplete' })
  reopen.focus()
  fireEvent.click(reopen)
  await screen.findByRole('heading', { name: 'No completed topics yet' })
  expect(screen.getByRole('button', { name: 'Completed (0)' })).toHaveFocus()
})

test('reading cards never completes a topic; an explicit card-screen choice updates the list', async () => {
  const store = repository()
  const save = vi.spyOn(store, 'setTopicCovered')
  navigate('#/topics/basic-queries/cards/basic-select')
  render(<App progressRepository={store} />)
  await readyButton()
  fireEvent.click(screen.getByRole('button', { name: 'Reveal answer' }))
  fireEvent.click(screen.getByRole('button', { name: /^Definition/ }))
  navigate('#/topics/basic-queries/cards/basic-distinct')
  await readyButton()
  expect(save).not.toHaveBeenCalled()
  fireEvent.click(await readyButton())
  await readyButton('Mark Basic queries incomplete')
  navigate('#/topics')
  expect(screen.getByText('1 of 14 topics completed')).toBeVisible()
  expect(save).toHaveBeenCalledTimes(1)
})

test('a failed initial load leaves learning available and retries without inventing saved progress', async () => {
  const store = repository()
  vi.spyOn(store, 'getAll').mockRejectedValueOnce(new Error('Storage is temporarily unavailable.'))
  render(<App progressRepository={store} />)
  const retry = await screen.findByRole('button', { name: 'Retry loading progress' })
  expect(screen.getByRole('link', { name: 'Start learning Basic queries' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Mark Basic queries completed' })).toBeDisabled()
  expect(screen.queryByText('0 of 14 topics completed')).not.toBeInTheDocument()
  fireEvent.click(retry)
  await readyButton()
  expect(screen.getByText('0 of 14 topics completed')).toBeVisible()
})

test('a failed save keeps the last committed state and retries the same intended choice', async () => {
  const store = repository()
  const save = vi.spyOn(store, 'setTopicCovered').mockRejectedValueOnce(new DOMException('Storage is full.', 'QuotaExceededError'))
  render(<App progressRepository={store} />)
  fireEvent.click(await readyButton())
  const retry = await screen.findByRole('button', { name: 'Retry save' })
  expect(screen.getByText('0 of 14 topics completed')).toBeVisible()
  expect(await store.getAll()).toEqual([])
  fireEvent.click(retry)
  await readyButton('Mark Basic queries incomplete')
  expect(screen.getByText('1 of 14 topics completed')).toBeVisible()
  expect(save).toHaveBeenCalledTimes(2)
})

test('does not claim completion or accept duplicate clicks before the save finishes', async () => {
  const store = repository()
  const original = store.setTopicCovered.bind(store)
  let finish: (() => Promise<void>) | undefined
  const save = vi.spyOn(store, 'setTopicCovered').mockImplementationOnce((input) => new Promise<CoverageResult>((resolve, reject) => {
    finish = () => original(input).then(resolve, reject)
  }))
  render(<App progressRepository={store} />)
  const button = await readyButton()
  fireEvent.click(button)
  expect(button).toBeDisabled()
  expect(screen.getByText('0 of 14 topics completed')).toBeVisible()
  fireEvent.click(button)
  expect(save).toHaveBeenCalledTimes(1)
  expect(await store.getAll()).toEqual([])
  await act(async () => { await finish!() })
  await readyButton('Mark Basic queries incomplete')
  expect(screen.getByText('1 of 14 topics completed')).toBeVisible()
})

test('detects another tab changing progress and requires an explicit retry before overwriting', async () => {
  const store = repository()
  render(<App progressRepository={store} />)
  await readyButton()
  const otherTab = repository()
  await setCovered(otherTab, 'basic-queries', true, 0)
  await setCovered(otherTab, 'basic-queries', false, 1)
  fireEvent.click(screen.getByRole('button', { name: 'Mark Basic queries completed' }))
  const retry = await screen.findByRole('button', { name: 'Retry save' })
  expect(screen.getByText('0 of 14 topics completed')).toBeVisible()
  expect(await otherTab.getAll()).toEqual([expect.objectContaining({ covered: false, version: 2 })])
  fireEvent.click(retry)
  await readyButton('Mark Basic queries incomplete')
  expect(await otherTab.getAll()).toEqual([expect.objectContaining({ covered: true, version: 3 })])
})

test('refreshes another tab’s committed progress when the window gains focus', async () => {
  const store = repository()
  const save = vi.spyOn(store, 'setTopicCovered')
  render(<App progressRepository={store} />)
  await readyButton()
  await setCovered(repository(), 'basic-queries', true, 0)
  fireEvent(window, new Event('focus'))
  await readyButton('Mark Basic queries incomplete')
  expect(screen.getByText('1 of 14 topics completed')).toBeVisible()
  expect(save).not.toHaveBeenCalled()
})

test('refreshes visible tabs after a pending save without losing either topic’s committed state', async () => {
  const store = repository()
  const original = store.setTopicCovered.bind(store)
  let finish: (() => Promise<void>) | undefined
  vi.spyOn(store, 'setTopicCovered').mockImplementationOnce((input) => new Promise<CoverageResult>((resolve, reject) => {
    finish = () => original(input).then(resolve, reject)
  }))
  render(<App progressRepository={store} />)
  fireEvent.click(await readyButton())
  navigate('#/topics/joins/cards/joins-inner-basic')
  await setCovered(repository(), 'joins', true, 0)
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  fireEvent(document, new Event('visibilitychange'))
  await act(async () => { await finish!() })
  await readyButton('Mark Joins incomplete')
  navigate('#/topics')
  expect(screen.getByText('2 of 14 topics completed')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Mark Basic queries incomplete' })).toBeEnabled()
  visibility.mockRestore()
})

test('preserves completion when cards disappear and excludes retired topics from the denominator', async () => {
  const store = repository()
  await setCovered(store, 'basic-queries', true, 0)
  await setCovered(store, 'retired-topic', true, 0)
  const catalog = loadCatalog()
  render(<App progressRepository={store} loadContent={() => ({ ...catalog, cards: catalog.cards.filter((card) => card.topicId !== 'basic-queries') })} />)
  const reopen = await readyButton('Mark Basic queries incomplete')
  expect(screen.getByText('1 of 14 topics completed')).toBeVisible()
  expect(screen.queryByRole('link', { name: 'Start learning Basic queries' })).not.toBeInTheDocument()
  fireEvent.click(reopen)
  await waitFor(() => expect(screen.getByText('0 of 14 topics completed')).toBeVisible())
  const complete = screen.queryByRole('button', { name: 'Mark Basic queries completed' })
  if (complete) expect(complete).toBeDisabled()
  expect((await store.getAll()).find((progress) => progress.topicId === 'retired-topic')?.covered).toBe(true)
})

test('shows a safe zero percentage for an empty active catalogue', async () => {
  render(<App progressRepository={repository()} loadContent={() => ({ schemaVersion: 1, contentVersion: 'empty', topics: [], cards: [] })} />)
  expect(await screen.findByText('0 of 0 topics completed')).toBeVisible()
  expect(screen.getByText('0% completed')).toBeVisible()
  expect(screen.getByRole('heading', { name: 'No topics yet' })).toBeVisible()
})
