import { StrictMode } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { loadCatalog } from '../content/catalog'
import App from './App'

beforeEach(() => { window.history.replaceState(null, '', '/') })

function navigate(hash: string) {
  act(() => {
    window.history.pushState(null, '', hash)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  })
}

test('shows the whole syllabus and only offers available learning content', () => {
  render(<StrictMode><App /></StrictMode>)
  expect(screen.getAllByRole('article')).toHaveLength(14)
  expect(screen.getAllByRole('link', { name: /^Start learning / })).toHaveLength(3)
  expect(screen.getAllByText('Content coming soon')).toHaveLength(11)
  expect(screen.getByText('6 flashcards ready · 3 of 14 topics with cards')).toBeVisible()
  expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
  expect(screen.queryByText('Intermediate')).not.toBeInTheDocument()
})

test('chooses a topic, reveals its answer and hides it again', async () => {
  render(<App />)
  fireEvent.click(screen.getByRole('link', { name: 'Start learning Basic queries' }))
  const reveal = await screen.findByRole('button', { name: 'Reveal answer' })
  const first = loadCatalog().cards.find((card) => card.id === 'basic-select')!
  expect(screen.queryByText(first.answer)).not.toBeInTheDocument()
  fireEvent.click(reveal)
  expect(within(screen.getByRole('region', { name: 'Answer' })).getByText(first.answer)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Hide answer' }))
  expect(screen.queryByRole('region', { name: 'Answer' })).not.toBeInTheDocument()
})

test('discloses one reference section at a time, renders SQL and tables, and restores focus on close', () => {
  navigate('#/topics/joins/cards/joins-left-basic')
  render(<App />)
  const definition = screen.getByRole('button', { name: /^Definition/ })
  fireEvent.click(definition)
  expect(screen.getByRole('region', { name: 'Definition' })).toBeVisible()
  const examples = screen.getByRole('button', { name: /^Examples/ })
  fireEvent.click(examples)
  expect(screen.queryByRole('region', { name: 'Definition' })).not.toBeInTheDocument()
  expect(definition).toHaveAttribute('aria-expanded', 'false')
  const panel = screen.getByRole('region', { name: 'Examples' })
  expect(within(panel).getAllByRole('table').length).toBeGreaterThan(1)
  expect(within(panel).getByText(/LEFT JOIN orders/)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Close section' }))
  expect(examples).toHaveFocus()
  expect(examples).toHaveAttribute('aria-expanded', 'false')
  for (const label of ['Concept', 'Syntax']) {
    const tile = screen.getByRole('button', { name: new RegExp(`^${label}`) })
    fireEvent.click(tile)
    expect(screen.getByRole('region', { name: label })).toBeVisible()
    fireEvent.click(tile)
    expect(screen.queryByRole('region', { name: label })).not.toBeInTheDocument()
  }
})

test('navigates within a topic without wrapping and resets transient study state', async () => {
  navigate('#/topics/joins/cards/joins-inner-basic')
  render(<App />)
  expect(screen.queryByRole('link', { name: 'Previous card' })).not.toBeInTheDocument()
  expect(screen.getByText('Previous card')).toHaveAttribute('aria-disabled', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'Reveal answer' }))
  fireEvent.click(screen.getByRole('button', { name: /^Syntax/ }))
  fireEvent.click(screen.getByRole('link', { name: 'Next card' }))
  expect(await screen.findByRole('heading', { name: 'Left Join', level: 1 })).toHaveFocus()
  expect(screen.getByRole('button', { name: 'Reveal answer' })).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByRole('button', { name: /^Syntax/ })).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('link', { name: 'Next card' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('link', { name: 'Previous card' }))
  await screen.findByRole('heading', { name: 'Inner Join', level: 1 })
  expect(screen.queryByRole('region', { name: 'Answer' })).not.toBeInTheDocument()
})

test('responds to browser history changes and reloads a deep link with answer hidden', async () => {
  navigate('#/topics/joins/cards/joins-inner-basic')
  const view = render(<App />)
  fireEvent.click(screen.getByRole('link', { name: 'Next card' }))
  await screen.findByRole('heading', { name: 'Left Join', level: 1 })
  fireEvent.click(screen.getByRole('button', { name: 'Reveal answer' }))
  act(() => { window.history.back() })
  await screen.findByRole('heading', { name: 'Inner Join', level: 1 })
  act(() => { window.history.forward() })
  await screen.findByRole('heading', { name: 'Left Join', level: 1 })
  expect(screen.queryByRole('region', { name: 'Answer' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Reveal answer' }))
  view.unmount()
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Left Join', level: 1 })).toHaveFocus()
  expect(screen.queryByRole('region', { name: 'Answer' })).not.toBeInTheDocument()
})

test.each(['#/no-such-page', '#/topics/joins/cards/no-such-card', '#/topics/filtering/cards/joins-left-basic'])('handles invalid or mismatched route %s safely', (hash) => {
  navigate(hash)
  render(<App />)
  expect(screen.getByRole('heading', { name: "This card isn't available" })).toBeVisible()
  expect(screen.getByRole('link', { name: 'Back to topics' })).toHaveAttribute('href', '#/topics')
  expect(screen.queryByRole('button', { name: 'Reveal answer' })).not.toBeInTheDocument()
})

test('recovers a failed content load and supports an empty collection', () => {
  const loader = vi.fn().mockImplementationOnce(() => { throw new Error('Invalid content') }).mockImplementation(loadCatalog)
  const view = render(<App loadContent={loader} />)
  expect(screen.getByRole('heading', { name: "We couldn't load the cards" })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(screen.getAllByRole('article')).toHaveLength(14)
  view.unmount()
  render(<App loadContent={() => ({ schemaVersion: 1, contentVersion: 'empty', topics: [], cards: [] })} />)
  expect(screen.getByRole('heading', { name: 'No topics yet' })).toBeVisible()
  expect(screen.getByText('0 flashcards ready · 0 of 0 topics with cards')).toBeVisible()
})

test('skip link focuses main without changing the study route', async () => {
  navigate('#/topics/joins/cards/joins-left-basic')
  render(<App />)
  fireEvent.click(screen.getByRole('link', { name: 'Skip to content' }))
  await waitFor(() => expect(screen.getByRole('main')).toHaveFocus())
  expect(window.location.hash).toBe('#/topics/joins/cards/joins-left-basic')
})
