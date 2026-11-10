import { select, rpc, cached, peek } from '../lib/api.js'
import { searchArgs, searchKey, movieKey, subsKey, PAGE_SIZE, SUBTITLE_COLUMNS, SUBTITLE_ORDER } from '../lib/queries.js'

export { PAGE_SIZE }

/**
 * Public catalogue search. `lang` is a category code, or "other" (= every language
 * that is not one of the configured categories).
 */
export function searchMovies(options = {}) {
  const { args, parsed } = searchArgs(options)
  return cached(searchKey(args), async () => {
    let rows = await rpc('search_movies', args)
    // "1917" is a year *and* a title: when only a year was typed, also search titles for it.
    if (!parsed.text && parsed.year && !args.page_offset) {
      const byTitle = await rpc('search_movies', { ...args, q: String(parsed.year), year: null })
      const seen = new Set(rows.map((r) => r.id))
      rows = rows.concat(byTitle.filter((r) => !seen.has(r.id)))
    }
    return rows
  })
}
/** Last known result of the same search (from memory or the build-time snapshot), without a request. */
export const peekSearch = (options = {}) => peek(searchKey(searchArgs(options).args))

export async function getMovie(id) {
  const rows = await cached(movieKey(id), () => select('movie_cards', `id=eq.${Number(id)}&published=is.true&select=*&limit=1`), 30_000)
  return Array.isArray(rows) ? rows[0] || null : rows
}
export const peekMovie = (id) => {
  const rows = peek(movieKey(id))
  return Array.isArray(rows) ? rows[0] || null : rows || null
}

export const getSubtitles = (movieId) =>
  cached(subsKey(movieId), () => select('subtitles', `movie_id=eq.${Number(movieId)}&published=is.true&select=${SUBTITLE_COLUMNS}&order=${SUBTITLE_ORDER}`), 15_000)
export const peekSubtitles = (movieId) => peek(subsKey(movieId))

/** Counts the download. Fire-and-forget: the download itself is a normal link, so it never gets blocked. */
export function registerDownload(subtitleId) {
  return rpc('register_download', { p_subtitle_id: subtitleId }, { keepalive: true }).catch(() => null)
}

/** Genres and release years that exist in the published catalogue (for the filter menus). */
export async function getFacets() {
  return cached('facets', async () => {
    const rows = await select('movies', 'published=is.true&select=genres,release_year&limit=1000')
    return {
      genres: [...new Set(rows.flatMap((r) => r.genres || []))].sort(),
      years: [...new Set(rows.map((r) => r.release_year).filter(Boolean))].sort((a, b) => b - a),
    }
  }, 300_000)
}
export const getGenres = () => getFacets().then((f) => f.genres)
