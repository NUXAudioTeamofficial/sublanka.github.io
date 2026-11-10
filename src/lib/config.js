// Public runtime configuration. Everything here is safe to ship to the browser.
const env = import.meta.env

export const SUPABASE_URL = (env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
export const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY || ''
export const IS_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_KEY)

export const BASE = env.BASE_URL || '/'
// Absolute public address of the site (with trailing slash).
export const SITE_URL = (env.VITE_SITE_URL || (typeof window !== 'undefined' ? window.location.origin + BASE : '/')).replace(/\/*$/, '/')

export const asset = (file) => BASE + String(file).replace(/^\/+/, '')
