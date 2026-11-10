import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Captions, Pencil, Trash2, ShieldAlert, Download, ExternalLink } from 'lucide-react'
import { listSubtitles, setSubtitlePublished, disputeSubtitle, deleteSubtitle, friendlyError } from '../../services/admin.js'
import { Busy, PageHead, Pager, Toggle, useConfirm, useLoader, useToast } from '../../components/admin/ui.jsx'
import SubtitleForm from '../../components/admin/SubtitleForm.jsx'
import { PERMISSIONS } from '../../lib/constants.js'
import { compactNumber, formatDate } from '../../lib/format.js'
import { driveDownloadUrl } from '../../lib/drive.js'

const PAGE = 30
const LINK = { ok: ['Verified', 'badge-ok'], manual: ['Manual', 'badge-accent'], unverified: ['Unverified', 'badge-warn'], failed: ['Failed', 'badge-bad'] }

export default function Subtitles() {
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState(null)
  const toast = useToast()
  const confirm = useConfirm()
  const { data, error, loading, setData, reload } = useLoader(() => listSubtitles({ status, page, pageSize: PAGE }), [status, page])
  const patch = (row) => setData((d) => ({ ...d, rows: d.rows.map((s) => (s.id === row.id ? { ...s, ...row, movie: row.movie ?? s.movie } : s)) }))

  const act = async (fn, okMessage) => {
    try {
      const row = await fn()
      if (row) patch(row)
      toast(okMessage)
    } catch (err) {
      toast(friendlyError(err), 'bad')
    }
  }
  async function remove(sub) {
    const ok = await confirm({ title: 'Delete this subtitle entry?', message: 'The entry and its download count are removed. The file on Google Drive is not touched.', confirmLabel: 'Delete', danger: true })
    if (!ok) return
    try {
      await deleteSubtitle(sub.id)
      toast('Subtitle entry deleted.')
      reload()
    } catch (err) {
      toast(friendlyError(err), 'bad')
    }
  }

  return (
    <>
      <PageHead title="Subtitles" sub="Every subtitle file on the site. To add one, open its movie." />
      <div className="toolbar">
        <select className="select" aria-label="Filter" value={status} onChange={(e) => (setStatus(e.target.value), setPage(0))}>
          <option value="all">All subtitles</option>
          <option value="published">Published</option>
          <option value="draft">Not published</option>
          <option value="unverified">Link not verified</option>
          <option value="disputed">Disputed</option>
        </select>
      </div>
      {error && <p className="notice notice-bad">{friendlyError(error)}</p>}
      {loading && !data && <Busy />}
      {data && !data.rows.length && (
        <div className="empty">
          <div className="empty-icon">
            <Captions />
          </div>
          <h3>No subtitles here</h3>
          <p>Open a movie and use “Add subtitle” to attach a Google Drive file.</p>
          <Link className="btn" to="/admin/movies/">
            Go to movies
          </Link>
        </div>
      )}
      {data && data.rows.length > 0 && (
        <div className={`table-wrap ${loading ? 'is-loading' : ''}`}>
          <table className="table">
            <thead>
              <tr>
                <th>Movie / version</th>
                <th>Rights</th>
                <th>Link</th>
                <th>Downloads</th>
                <th>Added</th>
                <th>Published</th>
                <th className="t-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((s) => {
                const [linkLabel, linkClass] = LINK[s.link_status] || LINK.unverified
                return (
                  <tr key={s.id}>
                    <td data-label="Movie">
                      <Link className="cell-title" to={`/admin/movies/${s.movie?.id}/`}>
                        <strong>{s.movie?.title}</strong> <span className="dim">{s.movie?.release_year}</span>
                        <small>
                          {s.format.toUpperCase()} · {s.version || 'no version label'}
                          {s.translator ? ` · ${s.translator}` : ''}
                          {s.movie && !s.movie.published ? ' · movie is hidden' : ''}
                        </small>
                      </Link>
                    </td>
                    <td data-label="Rights">
                      <span className={`badge ${s.permission_status === 'disputed' ? 'badge-bad' : PERMISSIONS[s.permission_status]?.publishable ? 'badge-ok' : 'badge-warn'}`}>{PERMISSIONS[s.permission_status]?.label}</span>
                    </td>
                    <td data-label="Link">
                      <span className={`badge ${linkClass}`}>{linkLabel}</span>
                    </td>
                    <td data-label="Downloads">
                      <span className="inline-ico"><Download size={13} /> {compactNumber(s.download_count)}</span>
                    </td>
                    <td data-label="Added">{formatDate(s.created_at)}</td>
                    <td data-label="Published">
                      <Toggle checked={s.published} label="Published" onChange={(v) => act(() => setSubtitlePublished(s.id, v), v ? 'Subtitle is now public.' : 'Subtitle hidden.')} />
                    </td>
                    <td className="t-right" data-label="Actions">
                      <div className="row-actions">
                        {s.drive_file_id && (
                          <a className="icon-btn" href={driveDownloadUrl(s.drive_file_id)} target="_blank" rel="noopener noreferrer" title="Test download" aria-label="Test download">
                            <ExternalLink />
                          </a>
                        )}
                        <button type="button" className="icon-btn" title="Edit" aria-label="Edit" onClick={() => setEditing(s)}>
                          <Pencil />
                        </button>
                        {s.permission_status !== 'disputed' && (
                          <button type="button" className="icon-btn icon-warn" title="Dispute: take offline now" aria-label="Dispute: take offline now" onClick={() => act(() => disputeSubtitle(s.id), 'Taken offline and marked as disputed.')}>
                            <ShieldAlert />
                          </button>
                        )}
                        <button type="button" className="icon-btn icon-danger" title="Delete" aria-label="Delete" onClick={() => remove(s)}>
                          <Trash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pager page={page} pageSize={PAGE} total={data.total} onPage={setPage} />}
      {editing && (
        <SubtitleForm
          movie={editing.movie}
          subtitle={editing}
          onClose={() => setEditing(null)}
          onSaved={(row) => {
            patch(row)
            setEditing(null)
          }}
        />
      )}
    </>
  )
}
