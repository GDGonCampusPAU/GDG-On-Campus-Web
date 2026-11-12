import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { EventProvider } from './context/EventContext.jsx'
import { loadEvent } from './data/event.js'
import './styles/tokens.css'
import './styles/fonts.css'
import './styles/base.css'

const root = createRoot(document.getElementById('root'))
async function start() {
  let initial
  let loadError = null
  try {
    initial = await loadEvent()
  } catch (error) {
    loadError = error
  }
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        {loadError && (
          <aside
            className="offline-banner"
            role="alert"
            style={{
              background: '#ea4335',
              color: '#ffffff',
              padding: '0.75rem 1rem',
              textAlign: 'center',
              fontSize: '0.9rem',
              fontWeight: 500,
            }}
          >
            <span>Etkinlik sunucusuna bağlanılamadı. Yedek içerik gösteriliyor. ({loadError.message})</span>
          </aside>
        )}
        <EventProvider initial={initial} initialError={loadError}>
          <App />
        </EventProvider>
      </BrowserRouter>
    </React.StrictMode>,
  )
}
start()
