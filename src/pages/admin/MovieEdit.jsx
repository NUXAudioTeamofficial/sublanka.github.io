import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Search, Loader2, Save, Sparkles, ExternalLink, Trash2, Plus, Download, Check, Youtube, Pencil, ShieldAlert } from 'lucide-react'
import {
  getMovieAdmin, saveMovie, deleteMovie, findMovieByTmdb, tmdbSearch, tmdbDetails, aiDescribe, listSubtitles, setSubtitlePublished, disputeSubtitle, deleteSubtitle, friendlyError,
} from '../../services/admin.js'
import { Busy, Field, PageHead, Toggle, useConfirm, useToast } from '../../components/admin/ui.jsx'
import SubtitleForm from '../../components/admin/SubtitleForm.jsx'
import { LANGS, PERMISSIONS } from '../../lib/constants.js'
import { parseYouTubeId, youtubeThumb, youtubeWatchUrl } from '../../lib/youtube.js'
import { moviePath, compactNumber } from '../../lib/format.js'

const EMPTY = {
  tmdb_id: '', title: '', original_title: '', release_year: '', language: 'en', poster_url: '', backdrop_url: '', overview: '',
  sinhala_description: '', genres: '', rating: '', vote_count: '', runtime: '', youtube_video_id: '', published: false,
}
const toForm = (m) => ({ ...EMPTY, ...Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v ?? ''])), genres: (m.genres || []).join(', '), published: !!m.published })
export const countWords = (text) => (String(text || '').trim().match(/\S+/g) || []).length
const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v))

export default function MovieEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(Boolean(id))
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(null)

  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState(null)
  const [tmdbError, setTmdbError] = useState('')
  const [trailers, setTrailers] = useState([])
  const [describing, setDescribing] = useState(false)

  const [subs, setSubs] = useState([])
  const [editing, setEditing] = useState(null) // null | {} (new) | subtitle row

  const set = (key) => (e) => {
    const value = e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e
    setForm((f) => ({ ...f, [key]: value }))
    setDirty(true)
  }

  useEffect(() => {
    if (!id) {
      setForm(EMPTY)
      setSaved(null)
      setSubs([])
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    Promise.all([getMovieAdmin(id), listSubtitles({ movieId: id, pageSize: 100 })])
      .then(([movie, list]) => {
        if (!alive) return
        if (!movie) return setLoadError('This movie does not exist (it may have been deleted).')
        setForm(toForm(movie))
        setSaved(movie)
        setSubs(list.rows)
        setDirty(false)
      })
      .catch((err) => alive && setLoadError(friendlyError(err)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [id])

  // ---- TMDB ----
  async function search(e) {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setTmdbError('')
    try {
      const m = query.trim().match(/^(.*?)[\s(]+((?:19|20)\d{2})\)?$/)
      const { results } = await tmdbSearch(m ? m[1] : query.trim(), m ? m[2] : undefined)
      setResults(results)
    } catch (err) {
      setTmdbError(err.message)
      setResults(null)
    } finally {
      setSearching(false)
    }
  }

  async function pick(result) {
    setSearching(true)
    setTmdbError('')
    try {
      if (!id) {
        const existing = await findMovieByTmdb(result.tmdb_id)
        if (existing) {
          toast(`“${existing.title}” is already in your library — opened it.`, 'info')
          navigate(`/admin/movies/${existing.id}/`)
          return
        }
      }
      const { movie, trailers } = await tmdbDetails(result.tmdb_id)
      setForm((f) => ({
        ...f,
        tmdb_id: movie.tmdb_id ?? '', title: movie.title || '', original_title: movie.original_title || '', release_year: movie.release_year ?? '',
        language: movie.language || 'en', poster_url: movie.poster_url || '', backdrop_url: movie.backdrop_url || '', overview: movie.overview || '',
        genres: (movie.genres || []).join(', '), rating: movie.rating ?? '', vote_count: movie.vote_count ?? '', runtime: movie.runtime ?? '',
      }))
      setTrailers(trailers || [])
      setResults(null)
      setDirty(true)
      toast('Details filled in from TMDB. Review them, choose a trailer, then save.', 'info')
    } catch (err) {
      setTmdbError(err.message)
    } finally {
      setSearching(false)
    }
  }

  async function describe() {
    setDescribing(true)
    try {
      const { description } = await aiDescribe({
        title: form.title, original_title: form.original_title, release_year: num(form.release_year), language: form.language,
        genres: form.genres.split(',').map((g) => g.trim()).filter(Boolean), overview: form.overview,
      })
      set('sinhala_description')(description)
      toast('Draft written from the verified overview. Read and correct it before saving.', 'info')
    } catch (err) {
      toast(err.message, 'bad')
    } finally {
      setDescribing(false)
    }
  }

  // ---- save ----
  const ytId = useMemo(() => parseYouTubeId(form.youtube_video_id), [form.youtube_video_id])
  const ytBad = Boolean(String(form.youtube_video_id).trim()) && !ytId
  const words = countWords(form.sinhala_description)

  async function submit(e) {
    e.preventDefault()
    if (ytBad) return toast('That does not look like a YouTube link or video ID.', 'bad')
    setSaving(true)
    try {
      const row = await saveMovie(id, {
        tmdb_id: num(form.tmdb_id), title: form.title, original_title: form.original_title, release_year: num(form.release_year), language: form.language,
        poster_url: form.poster_url, backdrop_url: form.backdrop_url, overview: form.overview, sinhala_description: form.sinhala_description,
        genres: form.genres.split(',').map((g) => g.trim()).filter(Boolean), rating: num(form.rating), vote_count: num(form.vote_count), runtime: num(form.runtime),
        youtube_video_id: ytId || '', published: form.published,
      })
      setSaved(row)
      setForm(toForm(row))
      setDirty(false)
      toast(row.published ? 'Saved — the movie is public.' : 'Saved as a draft (not visible to visitors).')
      if (!id) navigate(`/admin/movies/${row.id}/`, { replace: true })
    } catch (err) {
      toast(friendlyError(err), 'bad')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    const ok = await confirm({ title: `Delete “${form.title}”?`, message: 'This permanently deletes the movie and all its subtitle entries. Files on Google Drive are not touched.', confirmLabel: 'Delete permanently', danger: true })
    if (!ok) return
    try {
      await deleteMovie(id)
      toast('Movie deleted.')
      navigate('/admin/movies/')
    } catch (err) {
      toast(friendlyError(err), 'bad')
    }
  }

  // ---- subtitles of this movie ----
  const patchSub = (row) => setSubs((list) => (list.some((s) => s.id === row.id) ? list.map((s) => (s.id === row.id ? row : s)) : [row, ...list]))
  async function toggleSub(sub, published) {
    try {
      patchSub(await setSubtitlePublished(sub.id, published))
      toast(published ? 'Subtitle is now public.' : 'Subtitle hidden.')
    } catch (err) {
      toast(friendlyError(err), 'bad')
    }
  }
  async function dispute(sub) {
    try {
      patchSub(await disputeSubtitle(sub.id))
      toast('Taken offline and marked as disputed.')
    } catch (err) {
      toast(friendlyError(err), 'bad')
    }
  }
  async function removeSub(sub) {
    const ok = await confirm({ title: 'Delete this subtitle entry?', message: 'The entry and its download count are removed. The file on Google Drive is not touched.', confirmLabel: 'Delete', danger: true })
    if (!ok) return
    try {
      await deleteSubtitle(sub.id)
      setSubs((list) => list.filter((s) => s.id !== sub.id))
      toast('Subtitle entry deleted.')
    } catch (err) {
      toast(friendlyError(err), 'bad')
    }
  }

  if (loading) return <Busy />
  if (loadError)
    return (
      <>
        <p className="notice notice-bad">{loadError}</p>
        <Link className="btn btn-ghost" to="/admin/movies/">
          <ArrowLeft /> Back to movies
        </Link>
      </>
    )

  return (
    <>
      <PageHead title={id ? form.title || 'Edit movie' : 'Add movie'} sub={id ? `Movie #${id}${dirty ? ' · unsaved changes' : ''}` : 'Search TMDB to fill the form, or type the details yourself.'}>
        <Link className="btn btn-ghost btn-sm" to="/admin/movies/">
          <ArrowLeft /> Movies
        </Link>
        {saved?.published && (
          <Link className="btn btn-ghost btn-sm" to={moviePath(saved)} target="_blank">
            <ExternalLink /> View on site
          </Link>
        )}
      </PageHead>

      <section className="panel">
        <h2>1 · Fetch details from TMDB</h2>
        <form className="toolbar" onSubmit={search}>
          <label className="search-box">
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">Search TMDB</span>
            <input className="input" placeholder="Movie title, optionally with year — e.g. Leo 2023" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <button className="btn btn-sm" disabled={searching || !query.trim()}>
            {searching ? <Loader2 className="spin" /> : <Search />} Search
          </button>
        </form>
        {tmdbError && <p className="notice notice-warn">{tmdbError}</p>}
        {results && !results.length && <p className="muted pad">TMDB found nothing for that. Check the spelling, or fill the form by hand.</p>}
        {results?.length > 0 && (
          <ul className="tmdb-results">
            {results.map((r) => (
              <li key={r.tmdb_id}>
                <button type="button" onClick={() => pick(r)} disabled={searching}>
                  {r.poster_url ? <img src={r.poster_url} alt="" loading="lazy" width="46" height="69" /> : <span className="cell-noposter" />}
                  <span>
                    <strong>{r.title}</strong> <span className="dim">{r.release_year || '—'}</span>
                    <small>
                      {LANGS[r.language]?.en || r.language?.toUpperCase()}
                      {r.original_title && r.original_title !== r.title ? ` · ${r.original_title}` : ''}
                    </small>
                    <small className="clamp-2">{r.overview || 'No overview on TMDB.'}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="hint">Metadata and images come from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
      </section>

      <form className="panel" onSubmit={submit}>
        <h2>2 · Movie details</h2>
        <div className="form-grid">
          <Field label="Title *" className="span-2">
            <input className="input" required maxLength={300} value={form.title} onChange={set('title')} />
          </Field>
          <Field label="Original title">
            <input className="input" value={form.original_title} onChange={set('original_title')} />
          </Field>
          <Field label="Year">
            <input className="input" type="number" min="1880" max="2100" value={form.release_year} onChange={set('release_year')} />
          </Field>
          <Field label="Original language" hint="Decides which category the movie appears in.">
            <select className="select" value={form.language} onChange={set('language')}>
              {Object.entries(LANGS).map(([code, l]) => (
                <option key={code} value={code}>
                  {l.en}
                </option>
              ))}
              {!LANGS[form.language] && <option value={form.language}>{String(form.language).toUpperCase()}</option>}
            </select>
          </Field>
          <Field label="Genres" hint="Comma separated, in English — e.g. Action, Thriller">
            <input className="input" value={form.genres} onChange={set('genres')} />
          </Field>
          <Field label="Rating (0–10)" hint="From TMDB. Leave empty if unknown — never guess.">
            <input className="input" type="number" min="0" max="10" step="0.1" value={form.rating} onChange={set('rating')} />
          </Field>
          <Field label="Runtime (minutes)">
            <input className="input" type="number" min="1" max="900" value={form.runtime} onChange={set('runtime')} />
          </Field>
          <Field label="TMDB ID">
            <input className="input" type="number" min="1" value={form.tmdb_id} onChange={set('tmdb_id')} />
          </Field>
          <Field label="Poster image URL" hint="https:// address" className="span-2">
            <input className="input" type="url" placeholder="https://image.tmdb.org/t/p/w500/…" value={form.poster_url} onChange={set('poster_url')} />
          </Field>
          <Field label="Backdrop image URL" className="span-2">
            <input className="input" type="url" value={form.backdrop_url} onChange={set('backdrop_url')} />
          </Field>
          {form.poster_url && /^https:\/\//.test(form.poster_url) && (
            <div className="poster-preview">
              <img src={form.poster_url} alt="Poster preview" />
            </div>
          )}
          <Field label="Verified overview (English, source of facts)" hint="Kept as the factual basis for the Sinhala description. Not shown to visitors." className="span-4">
            <textarea className="textarea" rows={4} value={form.overview} onChange={set('overview')} />
          </Field>
          <Field
            label="Sinhala description (shown on the movie page)"
            className="span-4"
            hint={`${words} words — aim for 50–100. No spoilers, nothing that is not in the verified overview.`}
            error={words > 0 && (words < 40 || words > 120) ? `${words} words — the target is 50–100.` : ''}
          >
            <textarea className="textarea" rows={6} lang="si" value={form.sinhala_description} onChange={set('sinhala_description')} />
          </Field>
          <div className="span-4 row-wrap">
            <button type="button" className="btn btn-ghost btn-sm" onClick={describe} disabled={describing || String(form.overview).trim().length < 40}>
              {describing ? <Loader2 className="spin" /> : <Sparkles />} Write a Sinhala draft with AI
            </button>
            <span className="hint">Uses only the title, year, genres and the verified overview above. Always read it before saving.</span>
          </div>
        </div>

        <h2>3 · Trailer (official YouTube embed)</h2>
        <div className="form-grid">
          <Field label="YouTube link or video ID" className="span-2" error={ytBad ? 'Not a valid YouTube link / 11-character ID.' : ''} hint="Leave empty if there is no official trailer — the page will say so politely.">
            <input className="input" placeholder="https://www.youtube.com/watch?v=…" value={form.youtube_video_id} onChange={set('youtube_video_id')} />
          </Field>
          {ytId && (
            <a className="yt-preview" href={youtubeWatchUrl(ytId)} target="_blank" rel="noopener noreferrer">
              <img src={youtubeThumb(ytId, 'mqdefault')} alt="" />
              <span>
                <Youtube size={16} /> Check on YouTube
              </span>
            </a>
          )}
        </div>
        {trailers.length > 0 && (
          <>
            <p className="hint">Trailers TMDB lists for this movie. Pick one yourself — nothing is selected automatically. Prefer the studio’s official channel.</p>
            <ul className="trailers">
              {trailers.map((t) => (
                <li key={t.key} className={ytId === t.key ? 'is-picked' : ''}>
                  <img src={youtubeThumb(t.key, 'mqdefault')} alt="" loading="lazy" />
                  <div>
                    <strong>{t.name}</strong>
                    <small>
                      {t.type}
                      {t.official ? ' · marked official' : ''}
                      {t.language ? ` · ${t.language.toUpperCase()}` : ''}
                    </small>
                    <div className="row-wrap">
                      <button type="button" className="btn btn-sm" onClick={() => set('youtube_video_id')(t.key)}>
                        {ytId === t.key ? <Check /> : <Plus />} {ytId === t.key ? 'Selected' : 'Use this'}
                      </button>
                      <a className="btn btn-ghost btn-sm" href={youtubeWatchUrl(t.key)} target="_blank" rel="noopener noreferrer">
                        <ExternalLink /> Watch
                      </a>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="save-bar">
          <label className="check">
            <input type="checkbox" checked={form.published} onChange={set('published')} />
            <span>
              <strong>Published</strong> — visible to everyone
            </span>
          </label>
          <span className="spacer" />
          {id && (
            <button type="button" className="btn btn-danger btn-sm" onClick={remove}>
              <Trash2 /> Delete
            </button>
          )}
          <button className="btn" disabled={saving}>
            {saving ? <Loader2 className="spin" /> : <Save />} {id ? 'Save changes' : 'Save movie'}
          </button>
        </div>
      </form>

      <section className="panel">
        <div className="panel-head">
          <h2>4 · Subtitle files</h2>
          {id && (
            <button type="button" className="btn btn-sm" onClick={() => setEditing({})}>
              <Plus /> Add subtitle
            </button>
          )}
        </div>
        {!id && <p className="muted pad">Save the movie first, then you can attach subtitle files.</p>}
        {id && !subs.length && <p className="muted pad">No subtitles yet. Upload the file to Google Drive, share it as “Anyone with the link”, then add it here.</p>}
        {id && subs.length > 0 && (
          <ul className="sub-admin-list">
            {subs.map((s) => (
              <li key={s.id}>
                <div>
                  <strong>
                    {s.format.toUpperCase()} · {s.version || 'No version label'}
                  </strong>
                  <small>
                    {s.translator ? `by ${s.translator} · ` : ''}
                    <Download size={12} /> {compactNumber(s.download_count)} · {PERMISSIONS[s.permission_status]?.label} · link {s.link_status}
                  </small>
                </div>
                <label className="toggle-label">
                  <Toggle checked={s.published} onChange={(v) => toggleSub(s, v)} label="Published" />
                  {s.published ? 'Live' : 'Hidden'}
                </label>
                <div className="row-actions">
                  <button type="button" className="icon-btn" title="Edit" aria-label="Edit" onClick={() => setEditing(s)}>
                    <Pencil />
                  </button>
                  {s.permission_status !== 'disputed' && (
                    <button type="button" className="icon-btn icon-warn" title="Dispute: take offline now" aria-label="Dispute: take offline now" onClick={() => dispute(s)}>
                      <ShieldAlert />
                    </button>
                  )}
                  <button type="button" className="icon-btn icon-danger" title="Delete" aria-label="Delete" onClick={() => removeSub(s)}>
                    <Trash2 />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing && (
        <SubtitleForm
          movie={saved}
          subtitle={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={(row) => {
            patchSub(row)
            setEditing(null)
          }}
        />
      )}
    </>
  )
}
