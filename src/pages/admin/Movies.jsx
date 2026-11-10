import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Pencil, Trash2, ExternalLink, Film } from 'lucide-react'
import { listMovies, setMoviePublished, deleteMovie, friendlyError } from '../../services/admin.js'
import { Busy, PageHead, Pager, Toggle, useConfirm, useLoader, useToast } from '../../components/admin/ui.jsx'
import { langName } from '../../lib/constants.js'
import { moviePath, tmdbSize, formatDate } from '../../lib/format.js'

const PAGE = 25

export default function Movies() {
  const [q, setQ] = useState('')
  const [term, setTerm] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(0)
  const toast = useToast()
  const confirm = useConfirm()

  useEffect(() => {
    const t = setTimeout(() => {
      setTerm(q)
      setPage(0)
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  const { data, error, loading, reload, setData } = useLoader(() => listMovies({ q: term, status, page, pageSize: PAGE }), [term, status, page])

  async function toggle(movie, published) {
    try {
      await setMoviePublished(movie.id, published)
      setData((d) => ({ ...d, rows: d.rows.map((m) => (m.id === movie.id ? { ...m, published } : m)) }))
      toast(published ? `“${movie.title}” is now public.` : `“${movie.title}” is hidden from the site.`)
    } catch (err) {
      toast(friendlyError(err), 'bad')
    }
  }

  async function remove(movie) {
    const count = movie.subtitles?.[0]?.count || 0
    const ok = await confirm({
      title: `Delete “${movie.title}”?`,
      message: `This permanently deletes the movie${count ? ` and its ${count} subtitle entr${count === 1 ? 'y' : 'ies'}` : ''}. Files on Google Drive are not touched. To hide it temporarily, switch “Published” off instead.`,
      confirmLabel: 'Delete permanently',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteMovie(movie.id)
      toast('Movie deleted.')
      reload()
    } catch (err) {
      toast(friendlyError(err), 'bad')
    }
  }

  return (
    <>
      <PageHead title="Movies" sub="Add a movie first, then attach its subtitle files.">
        <Link className="btn btn-sm" to="/admin/movies/new/">
          <Plus /> Add movie
        </Link>
      </PageHead>

      <div className="toolbar">
        <label className="search-box">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Search movies</span>
          <input className="input" type="search" placeholder="Search title or year…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select className="select" aria-label="Status" value={status} onChange={(e) => (setStatus(e.target.value), setPage(0))}>
          <option value="all">All</option>
          <option value="published">Published</option>
          <option value="draft">Drafts</option>
        </select>
      </div>

      {error && <p className="notice notice-bad">{friendlyError(error)}</p>}
      {loading && !data && <Busy />}
      {data && !data.rows.length && (
        <div className="empty">
          <div className="empty-icon">
            <Film />
          </div>
          <h3>{term || status !== 'all' ? 'Nothing matches' : 'No movies yet'}</h3>
          <p>{term || status !== 'all' ? 'Try a different search or filter.' : 'Add your first movie — TMDB can fill in the details for you.'}</p>
          <Link className="btn" to="/admin/movies/new/">
            <Plus /> Add movie
          </Link>
        </div>
      )}
      {data && data.rows.length > 0 && (
        <div className={`table-wrap ${loading ? 'is-loading' : ''}`}>
          <table className="table">
            <thead>
              <tr>
                <th>Movie</th>
                <th>Language</th>
                <th>Subtitles</th>
                <th>Added</th>
                <th>Published</th>
                <th className="t-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((m) => (
                <tr key={m.id}>
                  <td data-label="Movie">
                    <Link className="cell-movie" to={`/admin/movies/${m.id}/`}>
                      {m.poster_url ? <img src={tmdbSize(m.poster_url, 'w92')} alt="" loading="lazy" width="38" height="57" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} /> : <span className="cell-noposter" />}
                      <span>
                        <strong>{m.title}</strong>
                        <small>
                          {m.release_year || 'Year ?'}
                          {m.original_title && m.original_title !== m.title ? ` · ${m.original_title}` : ''}
                        </small>
                      </span>
                    </Link>
                  </td>
                  <td data-label="Language">{langName(m.language, 'en')}</td>
                  <td data-label="Subtitles">{m.subtitles?.[0]?.count ?? 0}</td>
                  <td data-label="Added">{formatDate(m.created_at)}</td>
                  <td data-label="Published">
                    <Toggle checked={m.published} onChange={(v) => toggle(m, v)} label={`Published: ${m.title}`} />
                  </td>
                  <td className="t-right" data-label="Actions">
                    <div className="row-actions">
                      {m.published && (
                        <Link className="icon-btn" to={moviePath(m)} target="_blank" aria-label="View on site" title="View on site">
                          <ExternalLink />
                        </Link>
                      )}
                      <Link className="icon-btn" to={`/admin/movies/${m.id}/`} aria-label="Edit" title="Edit">
                        <Pencil />
                      </Link>
                      <button type="button" className="icon-btn icon-danger" onClick={() => remove(m)} aria-label="Delete" title="Delete">
                        <Trash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pager page={page} pageSize={PAGE} total={data.total} onPage={setPage} />}
    </>
  )
}
