import { StrictMode } from 'react'
import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from './App'

test('renders the learning app and makes its current availability clear', () => {
  render(<StrictMode><App /></StrictMode>)

  const main = screen.getByRole('main')

  expect(screen.getByRole('link', { name: 'SQLFlashCards home' })).toBeVisible()
  expect(within(main).getByRole('heading', {
    level: 1,
    name: 'Your SQL practice starts here.',
  })).toBeVisible()
  expect(within(main).getByText(/Learning features are coming in future stages/))
    .toBeVisible()
})
