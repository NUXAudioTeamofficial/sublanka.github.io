import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource-variable/outfit'
import '@fontsource/noto-sans-sinhala/400.css'
import '@fontsource/noto-sans-sinhala/500.css'
import '@fontsource/noto-sans-sinhala/600.css'
import '@fontsource/noto-sans-sinhala/700.css'
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
