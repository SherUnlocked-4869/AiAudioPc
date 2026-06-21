import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { TabNav, type Tab } from '@/components/shell/TabNav'

const tabs: Tab[] = [
  { id: 'player', label: 'Player' },
  { id: 'history', label: 'History' },
  { id: 'profile', label: 'Profile' },
  { id: 'settings', label: 'Settings' },
]

describe('TabNav', () => {
  it('renders all four tab labels as buttons', () => {
    render(<TabNav tabs={tabs} activeId="player" onTabChange={() => {}} />)
    for (const t of tabs) {
      expect(screen.getByRole('button', { name: t.label })).toBeInTheDocument()
    }
  })

  it('marks the active tab with aria-selected="true"', () => {
    render(<TabNav tabs={tabs} activeId="profile" onTabChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Profile' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: 'Player' })).toHaveAttribute('aria-selected', 'false')
  })

  it('calls onTabChange with the clicked tab id', async () => {
    const onTabChange = vi.fn()
    render(<TabNav tabs={tabs} activeId="player" onTabChange={onTabChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'History' }))
    expect(onTabChange).toHaveBeenCalledWith('history')
  })
})
