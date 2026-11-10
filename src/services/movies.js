import { select, rpc, cached } from '../lib/api.js'
import { parseQuery } from '../lib/format.js'

export const PAGE_SIZE = 24

/**
 * Public catalogue search. `lang` is a category code, or "other" (= every language
 * that is not one of the configured categories).
 */
export async function searchMovies({ q = '', lang = '', genre = '', sort = 'recent', withSubs = false, page = 0, pageSize = PAGE_SIZE, categories = [] } = {}) {
  const parsed = parseQuery(q)
  const args = {
    q: parsed.text || null,
    genre: genre || null,
    year: parsed.year,
    sort,
    only_with_subs: withSubs,
    page_size: pageSize,
    page_offset: page * pageSize,
    langs: null,
    exclude_langs: null,
  }
  const language = lang || parsed.lang
  if (language === 'other') args.exclude_langs = categories.map((c) => c.code)
  else if (language) args.langs = [language]

  const key = 'search:' + JSON.stringify(args)
  return cached(key, async () => {
    let rows = await rpc('search_movies', args)
    // "1917" is a year *and* a title: when only a year was typed, also search titles for it.
    if (!parsed.text && parsed.year && page === 0) {
      const byTitle = await rpc('search_movies', { ...args, q: String(parsed.year), year: null })
      const seen = new Set(rows.map((r) => r.id))
      rows = rows.concat(byTitle.filter((r) => !seen.has(r.id)))
    }
    return rows
  })
}

export async function getMovie(id) {
  const rows = await cached(`movie:${id}`, () => select('movie_cards', `id=eq.${Number(id)}&published=is.true&select=*&limit=1`), 30_000)
  return rows[0] || null
}

export async function getSubtitles(movieId) {
  return select(
    'subtitles',
    `movie_id=eq.${Number(movieId)}&published=is.true&select=id,language,format,version,translator,description,drive_file_id,download_count,permission_status,permission_note,created_at&order=language.desc,created_at.desc`,
  )
}

/** Counts the download. Fire-and-forget: the download itself is a normal link, so it never gets blocked. */
export function registerDownload(subtitleId) {
  return rpc('register_download', { p_subtitle_id: subtitleId }, { keepalive: true }).catch(() => null)
}

export async function getGenres() {
  return cached('genres', async () => {
    const rows = await select('movies', 'published=is.true&select=genres&limit=1000')
    return [...new Set(rows.flatMap((r) => r.genres || []))].sort()
  }, 300_000)
}
