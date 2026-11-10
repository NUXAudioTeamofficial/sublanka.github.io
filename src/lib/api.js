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

// In-memory cache so going "back" to a list is instant.
//  - requests for the same key that are still on their way are shared (no duplicate calls);
//  - the build step may embed a snapshot ("seed") of the first data a page needs in the HTML,
//    so the page can paint at once. Seeded entries are always treated as stale: the fresh
//    data is still fetched and replaces them.
const cache = new Map()
const inflight = new Map()

try {
  const el = typeof document !== 'undefined' && document.getElementById('sl-seed')
  const data = el ? JSON.parse(el.textContent || '{}') : null
  if (data?.cache) for (const [key, value] of Object.entries(data.cache)) cache.set(key, { at: 0, value })
  if (data?.settings) cache.set('seed:settings', { at: 0, value: data.settings })
} catch { /* a broken snapshot must never break the app */ }

/** Last known value for a key (possibly stale), or undefined. Never triggers a request. */
export const peek = (key) => cache.get(key)?.value

export function cached(key, loader, ttlMs = 60_000) {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < ttlMs) return Promise.resolve(hit.value)
  const pending = inflight.get(key)
  if (pending) return pending
  const p = Promise.resolve()
    .then(loader)
    .then((value) => {
      cache.set(key, { at: Date.now(), value })
      return value
    })
    .finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}
export const clearCache = () => cache.clear()
