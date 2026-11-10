// Tiny PostgREST client for the PUBLIC pages (keeps the visitor bundle small —
// the full supabase-js SDK is only loaded inside the admin area).
import { SUPABASE_URL, SUPABASE_KEY, IS_CONFIGURED } from './config.js'

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function request(path, { method = 'GET', body, headers = {}, keepalive = false } = {}) {
  if (!IS_CONFIGURED) throw new ApiError('The site is not connected to its database yet.', 0, 'not_configured')
  let res
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method,
      keepalive,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('Network error — please check your connection.', 0, 'network')
  }
  if (!res.ok) {
    let detail = {}
    try {
      detail = await res.json()
    } catch { /* not json */ }
    throw new ApiError(detail.message || `Request failed (${res.status})`, res.status, detail.code)
  }
  if (res.status === 204) return null
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

export const select = (table, query = '') => request(`${table}?${query}`)
export const rpc = (fn, args = {}, opts = {}) => request(`rpc/${fn}`, { method: 'POST', body: args, ...opts })
export const insert = (table, row) => request(table, { method: 'POST', body: row, headers: { Prefer: 'return=minimal' } })

// Small in-memory cache so going "back" to a list is instant.
const cache = new Map()
export async function cached(key, loader, ttlMs = 60_000) {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < ttlMs) return hit.value
  const value = await loader()
  cache.set(key, { at: Date.now(), value })
  return value
}
export const clearCache = () => cache.clear()
