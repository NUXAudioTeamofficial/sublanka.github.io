import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource-variable/manrope/wght.css'
// Only the Sinhala glyphs of Noto Sans Sinhala are needed (Manrope draws the Latin text),
// in three weights: 400 body, 600 labels/buttons, 700 headings.
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
