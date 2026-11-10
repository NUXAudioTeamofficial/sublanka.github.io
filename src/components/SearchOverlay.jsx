import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, X, LoaderCircle, SearchX, ArrowRight } from 'lucide-react'
import { searchMovies } from '../services/movies.js'
import { useSettings } from '../context/SettingsContext.jsx'
import { moviePath, tmdbSize } from '../lib/format.js'
import { langName } from '../lib/constants.js'

export default function SearchOverlay({ onClose }) {
  const { settings } = useSettings()
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [q, setQ] = useState('')
  const [state, setState] = useState({ status: 'idle', rows: [] })

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setState({ status: 'idle', rows: [] })
      return
    }
    let alive = true
    setState((s) => ({ ...s, status: 'loading' }))
    const t = setTimeout(async () => {
      try {
        const rows = await searchMovies({ q: term, pageSize: 7, categories: settings.categories })
        if (alive) setState({ status: 'done', rows })
      } catch (e) {
        if (alive) setState({ status: 'error', rows: [], message: e.message })
      }
    }, 260)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [q, settings.categories])

  const submit = (e) => {
    e.preventDefault()
    const term = q.trim()
    navigate(term ? `/browse/?q=${encodeURIComponent(term)}` : '/browse/')
    onClose()
  }

  return (
    <div className="search-overlay" role="dialog" aria-modal="true" aria-label="සොයන්න">
      <button className="search-backdrop" onClick={onClose} aria-label="සෙවුම වසන්න" />
      <div className="search-panel">
        <form className="search-form" onSubmit={submit} role="search">
          {state.status === 'loading' ? <LoaderCircle className="spin" /> : <Search />}
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="චිත්‍රපටයේ නම, වසර, භාෂාව හෝ ප්‍රභේදය…"
            aria-label="චිත්‍රපට සොයන්න"
            autoComplete="off"
            enterKeyHint="search"
          />
          <button type="button" className="icon-btn" onClick={onClose} aria-label="වසන්න">
            <X />
          </button>
        </form>

        <div className="search-results" aria-live="polite">
          {state.status === 'idle' && (
            <p className="search-hint">
              උදා: <button type="button" onClick={() => setQ('2024')}>2024</button>
              <button type="button" onClick={() => setQ('Tamil')}>Tamil</button>
              <button type="button" onClick={() => setQ('Action')}>Action</button>
            </p>
          )}
          {state.status === 'error' && <p className="search-hint">{state.message}</p>}
          {state.status === 'done' && state.rows.length === 0 && (
            <div className="search-empty">
              <SearchX />
              <p>
                “{q.trim()}” සඳහා චිත්‍රපටයක් හමු නොවීය.
                <small>අක්ෂර වින්‍යාසය පරීක්ෂා කර නැවත උත්සාහ කරන්න.</small>
              </p>
            </div>
          )}
          {state.rows.length > 0 && (
            <ul>
              {state.rows.map((m) => (
                <li key={m.id}>
                  <Link to={moviePath(m)} onClick={onClose} className="search-item">
                    {m.poster_url ? <img src={tmdbSize(m.poster_url, 'w92')} alt="" width="46" height="69" loading="lazy" /> : <span className="search-thumb" />}
                    <span className="search-item-text">
                      <strong>{m.title}</strong>
                      <small>
                        {[m.release_year, langName(m.language), m.subtitle_count > 0 ? `උපසිරැසි ${m.subtitle_count}` : null].filter(Boolean).join(' • ')}
                      </small>
                    </span>
                    <ArrowRight />
                  </Link>
                </li>
              ))}
              <li>
                <button className="search-all" onClick={submit}>
                  සියලු ප්‍රතිඵල බලන්න <ArrowRight />
                </button>
              </li>
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
