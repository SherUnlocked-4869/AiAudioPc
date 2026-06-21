import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { InteractiveDots } from '@/components/ui/interactive-dots'

describe('InteractiveDots', () => {
  it('renders a canvas element', () => {
    const { container } = render(<InteractiveDots />)
    expect(container.querySelector('canvas')).not.toBeNull()
  })

  it('accepts custom dotColor, dotSize and opacity props without throwing', () => {
    const { container } = render(
      <InteractiveDots dotColor="#ff0000" dotSize={12} opacity={0.5} />
    )
    expect(container.querySelector('canvas')).not.toBeNull()
  })

  it('accepts an audioAnalyser prop (reserved) without throwing', () => {
    const { container } = render(
      <InteractiveDots audioAnalyser={undefined} />
    )
    expect(container.querySelector('canvas')).not.toBeNull()
  })
})
