import { LANGS } from './constants.js'

export const compactNumber = (n) => {
  const v = Number(n) || 0
  if (v < 1000) return String(v)
  if (v < 1_000_000) return (v / 1000).toFixed(v < 10_000 ? 1 : 0).replace(/\.0$/, '') + 'K'
  return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
}

export const formatDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const timeAgo = (iso) => {
  if (!iso) return ''
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return Math.floor(s / 60) + ' min ago'
  if (s < 86400) return Math.floor(s / 3600) + ' h ago'
  if (s < 86400 * 30) return Math.floor(s / 86400) + ' d ago'
  return formatDate(iso)
}

export const runtimeLabel = (min) => {
  const m = Number(min)
  if (!m) return ''
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`
}

export const moviePath = (m) => `/movie/${m.id}-${m.slug || 'movie'}/`

/** TMDB image URLs come in sizes; swap the size segment to build a srcset. */
export const tmdbSize = (url, size) => (url && url.includes('image.tmdb.org/t/p/') ? url.replace(/\/t\/p\/[^/]+\//, `/t/p/${size}/`) : url)
export const posterSrcSet = (url) =>
  url && url.includes('image.tmdb.org/t/p/')
    ? `${tmdbSize(url, 'w185')} 185w, ${tmdbSize(url, 'w342')} 342w, ${tmdbSize(url, 'w500')} 500w`
    : undefined

/** Backdrops are full-bleed, so they must scale to the viewport width. */
export const backdropSrcSet = (url) =>
  url && url.includes('image.tmdb.org/t/p/')
    ? `${tmdbSize(url, 'w300')} 300w, ${tmdbSize(url, 'w780')} 780w, ${tmdbSize(url, 'w1280')} 1280w`
    : undefined

/**
 * Splits a free-text search into structured filters:
 *   "leo 2023 tamil" -> { text: 'leo', year: 2023, lang: 'ta' }
 */
export function parseQuery(input) {
  const out = { text: '', year: null, lang: null }
  const words = []
  for (const tok of String(input || '').trim().split(/\s+/).filter(Boolean)) {
    const low = tok.toLowerCase()
    if (!out.year && /^(19|20)\d{2}$/.test(tok)) {
      out.year = Number(tok)
      continue
    }
    if (!out.lang) {
      const hit = Object.entries(LANGS).find(([, n]) => n.en.toLowerCase() === low || n.si === tok)
      if (hit) {
        out.lang = hit[0]
        continue
      }
    }
    words.push(tok)
  }
  out.text = words.join(' ')
  // A lone year or language word is still a valid title search ("1917", "English Vinglish")
  if (!out.text && out.year && !out.lang) return { text: '', year: out.year, lang: null }
  return out
}
