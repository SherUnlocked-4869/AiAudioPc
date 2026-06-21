import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import App from '@/App'

describe('App', () => {
  it('renders the dots canvas and the Claudio title', () => {
    const { container } = render(<App />)
    expect(container.querySelector('canvas')).not.toBeNull()
    expect(screen.getByText('Claudio')).toBeInTheDocument()
  })

  it('shows the Player view heading by default', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Player', level: 2 })).toBeInTheDocument()
  })

  it('switches to the Settings view when the Settings tab is clicked', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByRole('heading', { name: 'Settings', level: 2 })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Player', level: 2 })).not.toBeInTheDocument()
  })
})
