import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { loadEvent } from './data/event.js'
import './styles/tokens.css'
import './styles/fonts.css'
import './styles/base.css'

const root = createRoot(document.getElementById('root'))
async function start() {
  try {
    await loadEvent()
    root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
    )
  } catch (error) {
    root.render(<main className="container"><h1>Etkinlik bilgileri yüklenemedi</h1><p role="alert">{error.message}</p><button onClick={start}>Tekrar dene</button></main>)
  }
}
start()
