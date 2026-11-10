import { Link } from 'react-router-dom'
import { Film, Captions, Download, Inbox, Sparkles, Plus, RefreshCw } from 'lucide-react'
import { getDashboard, friendlyError } from '../../services/admin.js'
import { Busy, PageHead, useLoader } from '../../components/admin/ui.jsx'
import { compactNumber, timeAgo } from '../../lib/format.js'

const ACTION_LABEL = { created: 'added', updated: 'updated', deleted: 'deleted', published: 'published', unpublished: 'unpublished', disputed: 'marked disputed' }

function Stat({ icon: Icon, label, value, sub, to }) {
  const body = (
    <>
      <span className="stat-icon">
        <Icon size={20} aria-hidden="true" />
      </span>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </>
  )
  return to ? (
    <Link className="stat" to={to}>
      {body}
    </Link>
  ) : (
    <div className="stat">{body}</div>
  )
}

function SubList({ rows, empty, showDownloads }) {
  if (!rows.length) return <p className="muted pad">{empty}</p>
  return (
    <ul className="mini-list">
      {rows.map((s) => (
        <li key={s.id}>
          <Link to={`/admin/movies/${s.movie?.id}/`}>
            <strong>{s.movie?.title || 'Deleted movie'}</strong> {s.movie?.release_year ? <span className="dim">({s.movie.release_year})</span> : null}
            <small>
              {s.format?.toUpperCase()} {s.version ? `· ${s.version}` : ''}
            </small>
          </Link>
          <span className={`badge ${s.published ? 'badge-ok' : ''}`}>{s.published ? 'Live' : 'Draft'}</span>
          <span className="mini-meta">{showDownloads ? `${compactNumber(s.download_count)} download${s.download_count === 1 ? "" : "s"}` : timeAgo(s.created_at)}</span>
        </li>
      ))}
    </ul>
  )
}

export default function Dashboard() {
  const { data, error, loading, reload } = useLoader(getDashboard, [])
  return (
    <>
      <PageHead title="Dashboard" sub="What is on the site right now.">
        <button type="button" className="btn btn-ghost btn-sm" onClick={reload}>
          <RefreshCw /> Refresh
        </button>
        <Link className="btn btn-sm" to="/admin/movies/new/">
          <Plus /> Add movie
        </Link>
      </PageHead>
      {loading && <Busy />}
      {error && <p className="notice notice-bad">{friendlyError(error)}</p>}
      {data && (
        <>
          <div className="stats">
            <Stat icon={Film} label="Movies" value={data.stats.movies} sub={`${data.stats.movies_published} published`} to="/admin/movies/" />
            <Stat icon={Captions} label="Subtitles" value={data.stats.subtitles} sub={`${data.stats.subtitles_published} published`} to="/admin/subtitles/" />
            <Stat icon={Download} label="Downloads" value={compactNumber(data.stats.downloads)} sub="download button clicks" />
            <Stat icon={Inbox} label="Open requests" value={data.stats.open_requests} sub="contact / takedown" to="/admin/requests/" />
            <Stat icon={Sparkles} label="AI jobs waiting" value={data.stats.jobs_waiting} sub="need your review" to="/admin/ai/" />
          </div>
          <div className="panels">
            <section className="panel">
              <h2>Latest uploads</h2>
              <SubList rows={data.latest} empty="No subtitles yet. Add a movie, then add its subtitle file." />
            </section>
            <section className="panel">
              <h2>Most downloaded</h2>
              <SubList rows={data.popular} empty="No downloads recorded yet." showDownloads />
            </section>
            <section className="panel panel-wide">
              <h2>Recent activity</h2>
              {data.activity.length ? (
                <ul className="mini-list">
                  {data.activity.map((a) => (
                    <li key={a.id}>
                      <span>
                        <strong className="cap">{a.entity}</strong> {ACTION_LABEL[a.action] || a.action}
                        {a.label ? <span className="muted"> — {a.label}</span> : null}
                      </span>
                      <span className="mini-meta">{timeAgo(a.created_at)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted pad">Nothing has happened yet.</p>
              )}
            </section>
          </div>
        </>
      )}
    </>
  )
}
