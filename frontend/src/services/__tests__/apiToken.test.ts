import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  API_BASE,
  API_TOKEN,
  apiFetch,
  applyRuntimeConfig,
  setApiBase,
  setApiToken,
} from '@/services/api/client'

describe('apiFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    setApiToken(undefined)
    setApiBase('/api')
  })

  it('sends the app token on every API request once it is set', async () => {
    const fetchMock = vi.fn(async () => new Response('{}'))
    vi.stubGlobal('fetch', fetchMock)
    setApiToken('s3cret')

    await apiFetch(`${API_BASE}/health`, { method: 'GET' })

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(new Headers(init.headers).get('X-Pi-Token')).toBe('s3cret')
  })

  it('sends no token header when none is set (development)', async () => {
    const fetchMock = vi.fn(async () => new Response('{}'))
    vi.stubGlobal('fetch', fetchMock)

    await apiFetch(`${API_BASE}/health`)

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit | undefined]
    expect(init?.headers).toBeUndefined()
  })
})

describe('applyRuntimeConfig', () => {
  afterEach(() => {
    setApiToken(undefined)
    setApiBase('/api')
  })

  it("takes the backend address and the token from the window's startup config", () => {
    applyRuntimeConfig({ apiBase: 'http://127.0.0.1:9000/api', token: 'abc' })
    expect(API_BASE).toBe('http://127.0.0.1:9000/api')
    expect(API_TOKEN).toBe('abc')
  })

  it('does nothing when there is no config (development)', () => {
    applyRuntimeConfig(undefined)
    expect(API_BASE).toBe('/api')
    expect(API_TOKEN).toBeUndefined()
  })
})
