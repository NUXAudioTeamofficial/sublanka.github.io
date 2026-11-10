import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { loadSettings, DEFAULT_SETTINGS } from '../services/settings.js'
import { IS_CONFIGURED } from '../lib/config.js'
import { peek } from '../lib/api.js'

const Ctx = createContext({ settings: DEFAULT_SETTINGS, reload: () => {} })
const KEY = 'sublanka:settings'

const readCache = () => {
  try {
    // defaults < snapshot written at build time < what this tab loaded last
    return { ...DEFAULT_SETTINGS, ...(peek('seed:settings') || {}), ...JSON.parse(sessionStorage.getItem(KEY) || '{}') }
  } catch {
    return { ...DEFAULT_SETTINGS, ...(peek('seed:settings') || {}) }
  }
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(readCache)

  const reload = useCallback(async () => {
    if (!IS_CONFIGURED) return
    try {
      const s = await loadSettings()
      // keep the same object when nothing changed, so pages do not re-render / re-fetch
      setSettings((prev) => (JSON.stringify(prev) === JSON.stringify(s) ? prev : s))
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
