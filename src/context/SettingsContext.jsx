import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { loadSettings, DEFAULT_SETTINGS } from '../services/settings.js'
import { IS_CONFIGURED } from '../lib/config.js'

const Ctx = createContext({ settings: DEFAULT_SETTINGS, reload: () => {} })
const KEY = 'sublanka:settings'

const readCache = () => {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(sessionStorage.getItem(KEY) || '{}') }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(readCache)

  const reload = useCallback(async () => {
    if (!IS_CONFIGURED) return
    try {
      const s = await loadSettings()
      setSettings(s)
      try {
        sessionStorage.setItem(KEY, JSON.stringify(s))
      } catch { /* private mode */ }
    } catch { /* keep defaults */ }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return <Ctx.Provider value={{ settings, reload }}>{children}</Ctx.Provider>
}

export const useSettings = () => useContext(Ctx)
