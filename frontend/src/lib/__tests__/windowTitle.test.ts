import { describe, it, expect } from 'vitest'
import { windowTitle } from '@/lib/windowTitle'

describe('windowTitle', () => {
  it('is just the app name when no project is open', () => {
    expect(windowTitle(undefined)).toBe('Pimika')
    expect(windowTitle('')).toBe('Pimika')
  })

  it('shows the project path after the app name', () => {
    expect(windowTitle('/Users/myadmin/Desktop/web')).toBe('Pimika — /Users/myadmin/Desktop/web')
  })
})
