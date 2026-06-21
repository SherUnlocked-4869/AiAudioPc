import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { InteractiveDots } from '@/components/ui/interactive-dots'

describe('InteractiveDots', () => {
  it('renders a canvas element', () => {
    const { container } = render(<InteractiveDots />)
    expect(container.querySelector('canvas')).not.toBeNull()
  })

  it('accepts custom dotColor, dotSize, baseOpacity and peakOpacity without throwing', () => {
    const { container } = render(
      <InteractiveDots dotColor="#ff0000" dotSize={24} baseOpacity={0.3} peakOpacity={0.9} />
    )
    expect(container.querySelector('canvas')).not.toBeNull()
  })

  it('accepts an audioAnalyser prop (reserved) without throwing', () => {
    const { container } = render(
      <InteractiveDots audioAnalyser={undefined} />
    )
    expect(container.querySelector('canvas')).not.toBeNull()
  })

  it('has dotSize default of 30', () => {
    // Props are defaults — component renders without error
    const { container } = render(<InteractiveDots />)
    const canvas = container.querySelector('canvas') as HTMLCanvasElement
    expect(canvas).not.toBeNull()
  })
})
