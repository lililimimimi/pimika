import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { ToastProvider } from '@/components/Toast'
import { applyRuntimeConfig } from '@/services/api/client'
import './index.css'
import 'highlight.js/styles/github-dark.css'

// The packaged app sets window.__PI_CONFIG__ before the page loads; in development it is absent
applyRuntimeConfig((window as { __PI_CONFIG__?: { apiBase?: string; token?: string } }).__PI_CONFIG__)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
)
