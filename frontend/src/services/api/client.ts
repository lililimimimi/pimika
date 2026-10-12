/**
 * Base address of the backend API. Every request in services/api goes through it.
 * '/api' works in development (the Vite proxy forwards it). The packaged app sets the real
 * address at startup with setApiBase, because its backend port is only known when it starts.
 */
export let API_BASE = '/api'

export function setApiBase(base: string): void {
  API_BASE = base
}

/** The app token, sent with every API request when the packaged app has one. Undefined in development. */
export let API_TOKEN: string | undefined

export function setApiToken(token: string | undefined): void {
  API_TOKEN = token
}

/** fetch for the backend API: adds the app token header when there is one */
export function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  if (!API_TOKEN) return fetch(url, init)
  const headers = new Headers(init.headers)
  headers.set('X-Pi-Token', API_TOKEN)
  return fetch(url, { ...init, headers })
}

/**
 * Takes the backend address and token that the packaged window was started with.
 * The window's startup script sets window.__PI_CONFIG__; without it (development) nothing changes.
 */
export function applyRuntimeConfig(config: { apiBase?: string; token?: string } | undefined): void {
  if (config?.apiBase) setApiBase(config.apiBase)
  if (config?.token) setApiToken(config.token)
}

/**
 * The error for a failed response: the backend's own message when it sent one,
 * otherwise `fallback` with the status code.
 */
export async function requestError(res: Response, fallback: string): Promise<Error> {
  const data = await res.json().catch(() => null)
  return new Error(data?.error?.message || `${fallback}: ${res.status}`)
}
