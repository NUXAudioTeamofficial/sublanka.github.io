// Pure helpers shared by the browser app AND scripts/postbuild.mjs (Node).
// Keep this file free of browser / Vite APIs so both sides build exactly the
// same RPC arguments and cache keys.
import { parseQuery } from './format.js'

export const PAGE_SIZE = 24

/** Arguments of the public `search_movies` RPC. `lang` is a category code, or "other". */
export function searchArgs({ q = '', lang = '', genre = '', year = null, sort = 'recent', withSubs = false, page = 0, pageSize = PAGE_SIZE, categories = [] } = {}) {
  const parsed = parseQuery(q)
  const args = {
    q: parsed.text || null,
    genre: genre || null,
    year: parsed.year || (Number(year) > 0 ? Number(year) : null),
    sort,
    only_with_subs: Boolean(withSubs),
    page_size: pageSize,
    page_offset: page * pageSize,
    langs: null,
    exclude_langs: null,
  }
  const language = lang || parsed.lang
  if (language === 'other') args.exclude_langs = categories.map((c) => c.code)
  else if (language) args.langs = [language]
  return { args, parsed }
}

export const searchKey = (args) => 'search:' + JSON.stringify(args)
export const movieKey = (id) => `movie:${Number(id)}`
export const subsKey = (id) => `subs:${Number(id)}`

/** The three lists of the home page. */
export const HOME_QUERIES = {
  latest: { sort: 'latest', withSubs: true, pageSize: 14 },
  popular: { sort: 'popular', withSubs: true, pageSize: 10 },
  recent: { sort: 'recent', pageSize: 12 },
}
/** Default list of /browse/ (no filters). */
export const BROWSE_QUERY = { sort: 'latest' }

export const SUBTITLE_COLUMNS = 'id,language,format,version,translator,description,drive_file_id,download_count,permission_status,permission_note,created_at'
export const SUBTITLE_ORDER = 'language.desc,created_at.desc'

// The backdrop sits dimmed behind a gradient, so phones get the small file.
export const BACKDROP_SIZES = '(max-width: 760px) 250px, 100vw'
export const DETAIL_POSTER_SIZES = '(max-width: 700px) 118px, 290px'
export const CARD_POSTER_SIZES = '(max-width: 600px) 45vw, 200px'
