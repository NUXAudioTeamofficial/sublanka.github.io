import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource-variable/manrope'
// Sinhala subset only: Latin is already covered by Manrope, and shipping the
// Latin subset of Noto Sans Sinhala cost ~30 KB per visit for glyphs Manrope
// already has. Three weights (400/600/700) cover everything the UI asks for —
// the handful of `font-weight: 500` rules fall back to 400.
import '@fontsource/noto-sans-sinhala/sinhala-400.css'
import '@fontsource/noto-sans-sinhala/sinhala-600.css'
import '@fontsource/noto-sans-sinhala/sinhala-700.css'
import './styles/base.css'
import './styles/public.css'
import App from './App.jsx'
import { SettingsProvider } from './context/SettingsContext.jsx'
import { BASE } from './lib/config.js'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={BASE.replace(/\/$/, '') || undefined} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <SettingsProvider>
        <App />
      </SettingsProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
