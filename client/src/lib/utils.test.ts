import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn', () => {
  it('merges multiple class names into one string', () => {
    expect(cn('p-2', 'bg-red-500')).toBe('p-2 bg-red-500')
  })

  it('dedupes conflicting Tailwind classes, last wins', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('handles falsy values', () => {
    expect(cn('p-2', false, null, undefined, 'bg-red-500')).toBe('p-2 bg-red-500')
  })
})
