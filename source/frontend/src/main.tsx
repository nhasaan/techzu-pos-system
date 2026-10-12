import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { setAuthTokenGetter, setRefreshTokenGetter, setTokensUpdater, setSessionExpiredHandler } from './lib/api.ts'
import { useAuthStore } from './store/auth.ts'
try {
  const raw = localStorage.getItem('pos-theme')
  const theme = raw ? (JSON.parse(raw)?.state?.theme as 'dark' | 'light' | undefined) : null
  document.documentElement.classList.add(theme === 'light' ? 'light' : 'dark')
} catch {
  document.documentElement.classList.add('dark')
}

setAuthTokenGetter(() => useAuthStore.getState().accessToken)
setRefreshTokenGetter(() => useAuthStore.getState().refreshToken)
setTokensUpdater((accessToken, refreshToken) => useAuthStore.getState().setTokens(accessToken, refreshToken))
setSessionExpiredHandler(() => {
  useAuthStore.getState().clearAuth()
  window.location.href = '/login'
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
