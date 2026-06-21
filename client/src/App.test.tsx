import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import App from '@/App'
import { ClaudioProvider } from '@/hooks/useClaudio'

describe('App', () => {
  it('renders the dots canvas and the Claudio title', () => {
    const { container } = render(<ClaudioProvider><App /></ClaudioProvider>)
    expect(container.querySelector('canvas')).not.toBeNull()
    expect(screen.getAllByText('Claudio').length).toBeGreaterThanOrEqual(1)
  })

  it('shows the Player view (with waiting text) by default', () => {
    render(<ClaudioProvider><App /></ClaudioProvider>)
    expect(screen.getByRole('heading', { name: '等待播放…', level: 2 })).toBeInTheDocument()
  })

  it('switches to the Settings view when the Settings tab is clicked', async () => {
    render(<ClaudioProvider><App /></ClaudioProvider>)
    await userEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByRole('heading', { name: 'Settings', level: 2 })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '等待播放…', level: 2 })).not.toBeInTheDocument()
  })
})
