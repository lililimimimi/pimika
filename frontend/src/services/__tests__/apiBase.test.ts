import { describe, it, expect, afterEach } from 'vitest'
import { API_BASE, setApiBase } from '@/services/api/client'

describe('API_BASE', () => {
  afterEach(() => setApiBase('/api'))

  it('is /api by default, so the dev proxy keeps working', () => {
    expect(API_BASE).toBe('/api')
  })

  it("can be pointed at the packaged app's backend once it is known", () => {
    setApiBase('http://127.0.0.1:9000/api')
    expect(API_BASE).toBe('http://127.0.0.1:9000/api')
  })
})
