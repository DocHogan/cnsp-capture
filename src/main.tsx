import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('#root not found')

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch((err: unknown) => {
      console.error('sw registration failed', err)
    })
  })
}
