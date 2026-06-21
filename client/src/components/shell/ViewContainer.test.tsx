import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ViewContainer } from '@/components/shell/ViewContainer'

describe('ViewContainer', () => {
  it('renders the Player heading when active is "player"', () => {
    render(<ViewContainer active="player" />)
    expect(screen.getByRole('heading', { name: 'Player', level: 2 })).toBeInTheDocument()
  })

  it('renders the History heading when active is "history"', () => {
    render(<ViewContainer active="history" />)
    expect(screen.getByRole('heading', { name: 'History', level: 2 })).toBeInTheDocument()
  })

  it('renders the Settings heading when active is "settings"', () => {
    render(<ViewContainer active="settings" />)
    expect(screen.getByRole('heading', { name: 'Settings', level: 2 })).toBeInTheDocument()
  })

  it('falls back to Player when the id is unknown', () => {
    render(<ViewContainer active="nope" />)
    expect(screen.getByRole('heading', { name: 'Player', level: 2 })).toBeInTheDocument()
  })
})
