import { useEffect, useState } from 'react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { Button } from '@/components/ui/button'
import { API_BASE, apiFetch } from '@/services/api/client'

type AuthEvent = {
  type: string
  message?: string
  url?: string
  instructions?: string
  userCode?: string
  verificationUri?: string
}
type LoginStatus = { status: 'idle' | 'running' | 'done' | 'error'; events: AuthEvent[]; error?: string }

// Log in to a subscription (ChatGPT or Claude.ai) from inside the app.
// The Pi login runs in the bridge; this panel shows its sign-in link and waits.
export function OAuthLogin({
  providerId,
  label,
  onDone,
}: {
  providerId: string
  label: string
  onDone: () => void
}) {
  const [status, setStatus] = useState<LoginStatus>({ status: 'idle', events: [] })
  const [polling, setPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = async () => {
    setError(null)
    const res = await apiFetch(`${API_BASE}/providers/${providerId}/login`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok || data.error) {
      // Backend errors arrive as { error: { message } }; a failed login reported by the bridge is a plain string
      setError(data.error?.message || data.error || 'Could not start login')
      return
    }
    setPolling(true)
  }

  // Poll the login progress until it finishes
  useEffect(() => {
    if (!polling) return
    const timer = setInterval(async () => {
      const res = await apiFetch(`${API_BASE}/providers/${providerId}/login`)
      const data: LoginStatus = await res.json()
      setStatus(data)
      if (data.status === 'done') {
        setPolling(false)
        onDone()
      } else if (data.status === 'error') {
        setPolling(false)
        setError(data.error ?? 'Login failed')
      }
    }, 1500)
    return () => clearInterval(timer)
  }, [polling, onDone, providerId])

  const authUrl = [...status.events].reverse().find((e) => e.type === 'auth_url')?.url

  // window.open does nothing inside the desktop window, so the link goes to the default browser
  const openLoginPage = (url: string) => {
    openUrl(url).catch(() => window.open(url, '_blank'))
  }

  // Open the login page once, as soon as the bridge has a link for it
  useEffect(() => {
    if (!authUrl) return
    openUrl(authUrl).catch(() => window.open(authUrl, '_blank'))
  }, [authUrl])

  if (!polling && status.status !== 'running') {
    return (
      <div className="space-y-2">
        <Button variant="outline" size="sm" onClick={start}>
          {label}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {authUrl && (
        <Button variant="outline" size="sm" onClick={() => openLoginPage(authUrl)}>
          Open login page
        </Button>
      )}

      <p className="text-sm text-muted-foreground">Waiting for you to finish in the browser…</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
