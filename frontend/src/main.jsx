import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './styles/theme.css'
import './styles/auth.css'
import './styles/panel.css'
import App from './App.jsx'
import { legacyHashPath } from './lib/routing.js'

// Eski #/... yer imlerini router başlamadan gerçek yola çevir.
const legacy = legacyHashPath(window.location.hash)
if (legacy) window.history.replaceState(null, '', legacy)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
