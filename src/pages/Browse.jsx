import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, X, LoaderCircle, Plus, Captions } from 'lucide-react'
import { searchMovies, peekSearch, getFacets, PAGE_SIZE } from '../services/movies.js'
import { useSettings } from '../context/SettingsContext.jsx'
import { useSeo } from '../lib/seo.js'
import { SORTS, genreName, langName } from '../lib/constants.js'
import MovieCard from '../components/MovieCard.jsx'
import { Empty, ErrorState, SkeletonCards } from '../components/States.jsx'

const SEARCH_DELAY = 350

export default function Browse() {
  const { settings } = useSettings()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const lang = params.get('lang') || ''
  const genre = params.get('genre') || ''
  const sort = SORTS.some((s) => s.id === params.get('sort')) ? params.get('sort') : 'latest'
  const year = /^(18|19|20)\d{2}$/.test(params.get('year') || '') ? params.get('year') : ''
  const subsOnly = params.get('subs') === '1'

  const [input, setInput] = useState(q)
  const [facets, setFacets] = useState({ genres: [], years: [] })
  // The configured categories only matter for the "other languages" filter. Using their content
  // (not the array identity) keeps the list from being fetched twice when settings arrive.
  const catsKey = lang === 'other' ? JSON.stringify(settings.categories.map((c) => c.code)) : ''
  const query = useMemo(
    () => ({ q, lang, genre, year, sort, withSubs: subsOnly, categories: catsKey ? JSON.parse(catsKey).map((code) => ({ code })) : [] }),
    [q, lang, genre, year, sort, subsOnly, catsKey],
  )
  const [state, setState] = useState(() => {
    const rows = peekSearch({ ...query, page: 0 })
    return rows ? { status: 'done', rows, page: 0, hasMore: rows.length >= PAGE_SIZE } : { status: 'loading', rows: [], page: 0, hasMore: false }
  })
  const requestId = useRef(0)

  const cats = [...settings.categories, { code: 'other', en: 'Other', si: 'වෙනත්' }]
  const activeCat = cats.find((c) => c.code === lang)
  const sortInfo = SORTS.find((s) => s.id === sort)
  const heading = q ? `“${q}” සෙවුම් ප්‍රතිඵල` : activeCat ? `${activeCat.si} චිත්‍රපට — සිංහල උපසිරැසි` : lang ? `${langName(lang)} චිත්‍රපට` : 'සියලුම චිත්‍රපට'

  useSeo({
    title: q ? `${q} — සෙවුම` : activeCat ? `${activeCat.en} movies with Sinhala subtitles — ${activeCat.si} චිත්‍රපට` : 'සියලුම චිත්‍රපට — Browse Sinhala subtitles',
    description: activeCat
      ? `${activeCat.si} (${activeCat.en}) චිත්‍රපට සඳහා සිංහල උපසිරැසි. ${sortInfo.si}.`
      : 'සිංහල උපසිරැසි සහිත චිත්‍රපට සොයන්න — නම, වසර, භාෂාව සහ ප්‍රභේදය අනුව පෙරන්න.',
    path: lang && !q && !genre ? `browse/?lang=${lang}` : 'browse/',
    noindex: Boolean(q),
    siteName: settings.site_name,
  })

  // keep the box in step with the address bar (back / forward), without eating a space the visitor just typed
  useEffect(() => setInput((cur) => (cur.trim() === q ? cur : q)), [q])
  useEffect(() => {
    getFacets().then(setFacets).catch(() => {})
  }, [])

  const update = (patch, replace = false) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    setParams(next, { replace })
  }

  // Search as you type: wait until typing pauses, and for at least two letters (or an emptied box).
  useEffect(() => {
    const next = input.trim()
    if (next === q || next.length === 1) return undefined
    const timer = setTimeout(() => update({ q: next }, true), SEARCH_DELAY)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, q])

  const fetchPage = useCallback(
    async (page) => {
      const id = ++requestId.current
      if (page === 0) {
        // show what we already know for this exact list at once, then refresh it quietly
        const known = peekSearch({ ...query, page: 0 })
        setState(known ? { status: 'done', rows: known, page: 0, hasMore: known.length >= PAGE_SIZE } : { status: 'loading', rows: [], page: 0, hasMore: false })
      } else {
        setState((s) => ({ ...s, status: 'more' }))
      }
      try {
        const rows = await searchMovies({ ...query, page })
        if (id !== requestId.current) return
        setState((s) => ({ status: 'done', rows: page === 0 ? rows : [...s.rows, ...rows.filter((r) => !s.rows.some((x) => x.id === r.id))], page, hasMore: rows.length >= PAGE_SIZE }))
      } catch (error) {
        if (id === requestId.current) setState((s) => (page === 0 && s.status === 'done' ? s : { ...s, status: 'error', error }))
      }
    },
    [query],
  )

  useEffect(() => {
    fetchPage(0)
  }, [fetchPage])

  const submit = (e) => {
    e.preventDefault()
    update({ q: input.trim() })
  }
  const hasFilters = q || lang || genre || year || subsOnly
  const years = year && !facets.years.includes(Number(year)) ? [Number(year), ...facets.years] : facets.years

  return (
    <div className="wrap page">
      <header className="page-head">
        <p className="kicker">{q ? 'Search' : sortInfo.en}</p>
        <h1>{heading}</h1>
      </header>

      <div className="filters">
        <form className="filter-search" onSubmit={submit} role="search">
          <Search aria-hidden="true" />
          <input type="search" value={input} onChange={(e) => setInput(e.target.value)} placeholder="නම, වසර, භාෂාව හෝ ප්‍රභේදය…" aria-label="චිත්‍රපට සොයන්න" enterKeyHint="search" />
          {input && (
            <button type="button" aria-label="සෙවුම හිස් කරන්න" onClick={() => { setInput(''); update({ q: '' }) }}>
              <X />
            </button>
          )}
        </form>
        <label className="filter-select">
          <span className="sr-only">ප්‍රභේදය (Genre)</span>
          <select className="select" value={genre} onChange={(e) => update({ genre: e.target.value })}>
            <option value="">සියලු ප්‍රභේද</option>
            {facets.genres.map((g) => (
              <option key={g} value={g}>{genreName(g)}{genreName(g) !== g ? ` (${g})` : ''}</option>
            ))}
          </select>
        </label>
        <label className="filter-select filter-year">
          <span className="sr-only">වසර (Year)</span>
          <select className="select" value={year} onChange={(e) => update({ year: e.target.value })}>
            <option value="">සියලු වසර</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>
        <label className="filter-select filter-sort">
          <span className="sr-only">පිළිවෙළ (Sort)</span>
          <select className="select" value={sort} onChange={(e) => update({ sort: e.target.value === 'latest' ? '' : e.target.value })}>
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>{s.si} ({s.en})</option>
            ))}
          </select>
        </label>
      </div>

      <div className="chips-scroll" role="group" aria-label="භාෂාව අනුව පෙරන්න">
        <button className={`chip${!lang ? ' is-active' : ''}`} onClick={() => update({ lang: '' })} aria-pressed={!lang}>සියල්ල</button>
        {cats.map((c) => (
          <button key={c.code} className={`chip${lang === c.code ? ' is-active' : ''}`} onClick={() => update({ lang: c.code })} aria-pressed={lang === c.code}>
            {c.si} <small>{c.en}</small>
          </button>
        ))}
        <button className={`chip chip-subs${subsOnly ? ' is-active' : ''}`} onClick={() => update({ subs: subsOnly ? '' : '1' })} aria-pressed={subsOnly}>
          <Captions aria-hidden="true" /> උපසිරැසි ඇති ඒවා පමණක්
        </button>
        {hasFilters && (
          <button className="chip chip-clear" onClick={() => setParams(sort !== 'latest' ? { sort } : {})}>
            <X /> පෙරහන් ඉවත් කරන්න
          </button>
        )}
      </div>

      <div aria-live="polite" aria-busy={state.status === 'loading'}>
        {state.status === 'error' && state.rows.length === 0 ? (
          <ErrorState error={state.error} onRetry={() => fetchPage(0)} />
        ) : state.status === 'done' && state.rows.length === 0 ? (
          <Empty
            title={q ? 'ඔබ සෙවූ චිත්‍රපටය හමු වුණේ නැහැ.' : 'චිත්‍රපටයක් හමු නොවීය'}
            action={hasFilters ? <button className="btn btn-ghost btn-sm" onClick={() => setParams({})}>සියලුම චිත්‍රපට බලන්න</button> : null}
          >
            {q ? `“${q}” සඳහා ගැළපෙන කිසිවක් නැත. අක්ෂර වින්‍යාසය පරීක්ෂා කරන්න, නැතහොත් වෙනත් නමකින් උත්සාහ කරන්න.` : 'මෙම කාණ්ඩයට තවම චිත්‍රපට එක් කර නැත. ඉක්මනින් නැවත පැමිණෙන්න.'}
          </Empty>
        ) : (
          <>
            <div className="grid">
              {state.status === 'loading' ? <SkeletonCards count={12} /> : state.rows.map((m, i) => <MovieCard key={m.id} movie={m} showDownloads={sort === 'popular'} priority={i < 4} heading="h2" />)}
            </div>
            {state.hasMore && (
              <div className="load-more">
                <button className="btn btn-ghost" onClick={() => fetchPage(state.page + 1)} disabled={state.status === 'more'}>
                  {state.status === 'more' ? <LoaderCircle className="spin" /> : <Plus />} තවත් පෙන්වන්න
                </button>
              </div>
            )}
            {state.status === 'done' && !state.hasMore && state.rows.length > 0 && <p className="count-note">චිත්‍රපට {state.rows.length}ක් පෙන්වයි</p>}
          </>
        )}
      </div>
    </div>
  )
}
