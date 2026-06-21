import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ViewContainer } from '@/components/shell/ViewContainer'
import { ClaudioProvider } from '@/hooks/useClaudio'

describe('ViewContainer', () => {
  it('renders the Player view (waiting text) when active is "player"', () => {
    render(<ClaudioProvider><ViewContainer active="player" /></ClaudioProvider>)
    expect(screen.getByRole('heading', { name: '等待播放…', level: 2 })).toBeInTheDocument()
  })

  it('renders the History heading when active is "history"', () => {
    render(<ClaudioProvider><ViewContainer active="history" /></ClaudioProvider>)
    expect(screen.getByRole('heading', { name: 'History', level: 2 })).toBeInTheDocument()
  })

  it('renders the Settings heading when active is "settings"', () => {
    render(<ClaudioProvider><ViewContainer active="settings" /></ClaudioProvider>)
    expect(screen.getByRole('heading', { name: 'Settings', level: 2 })).toBeInTheDocument()
  })

  it('falls back to Player when the id is unknown', () => {
    render(<ClaudioProvider><ViewContainer active="nope" /></ClaudioProvider>)
    expect(screen.getByRole('heading', { name: '等待播放…', level: 2 })).toBeInTheDocument()
  })
})
