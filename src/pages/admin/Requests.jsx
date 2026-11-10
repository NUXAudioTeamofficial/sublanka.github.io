import { useState } from 'react'
import { Inbox, Mail, Trash2, ExternalLink, Save } from 'lucide-react'
import { listRequests, updateRequest, deleteRequest, friendlyError } from '../../services/admin.js'
import { Busy, PageHead, useConfirm, useLoader, useToast } from '../../components/admin/ui.jsx'
import { timeAgo } from '../../lib/format.js'

const KIND = { copyright: ['Copyright / takedown', 'badge-bad'], correction: ['Correction', 'badge-warn'], general: ['General', ''] }
const STATUSES = ['new', 'reviewing', 'resolved', 'rejected']
const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : null)

function RequestCard({ item, onChange, onRemove }) {
  const toast = useToast()
  const [note, setNote] = useState(item.admin_note || '')
  const [status, setStatus] = useState(item.status)
  const [busy, setBusy] = useState(false)
  const [label, tone] = KIND[item.kind] || KIND.general
  const dirty = note !== (item.admin_note || '') || status !== item.status

  async function save() {
    setBusy(true)
    try {
      onChange(await updateRequest(item.id, { status, admin_note: note.trim() || null }))
      toast('Request updated.')
    } catch (err) {
      toast(friendlyError(err), 'bad')
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="request">
      <header>
        <span className={`badge ${tone}`}>{label}</span>
        <span className={`badge ${item.status === 'new' ? 'badge-accent' : ''}`}>{item.status}</span>
        <span className="mini-meta">{timeAgo(item.created_at)}</span>
      </header>
      <p className="request-from">
        <strong>{item.name}</strong> ·{' '}
        <a href={`mailto:${item.email}`}>
          <Mail size={13} /> {item.email}
        </a>
      </p>
      {item.page_url &&
        (safeUrl(item.page_url) ? (
          <a className="request-url" href={safeUrl(item.page_url)} target="_blank" rel="noopener noreferrer nofollow">
            <ExternalLink size={13} /> {item.page_url}
          </a>
        ) : (
          <p className="request-url">{item.page_url}</p>
        ))}
      <p className="request-body">{item.message}</p>
      <div className="request-foot">
        <select className="select" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input className="input" placeholder="Private note (what you did)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button type="button" className="btn btn-sm" disabled={!dirty || busy} onClick={save}>
          <Save /> Save
        </button>
        <button type="button" className="icon-btn icon-danger" aria-label="Delete request" title="Delete" onClick={() => onRemove(item)}>
          <Trash2 />
        </button>
      </div>
    </article>
  )
}

export default function Requests() {
  const [filter, setFilter] = useState('open')
  const toast = useToast()
  const confirm = useConfirm()
  const { data, error, loading, setData } = useLoader(() => listRequests(filter), [filter])

  async function remove(item) {
    const ok = await confirm({ title: 'Delete this request?', message: 'The message is permanently removed. Keep copyright requests until they are fully resolved.', confirmLabel: 'Delete', danger: true })
    if (!ok) return
    try {
      await deleteRequest(item.id)
      setData((list) => list.filter((r) => r.id !== item.id))
      toast('Request deleted.')
    } catch (err) {
      toast(friendlyError(err), 'bad')
    }
  }

  return (
    <>
      <PageHead title="Requests" sub="Messages from the Copyright & Contact page. For a takedown: open Subtitles, press the shield (Dispute) on the file — it goes offline at once — then answer here." />
      <div className="toolbar">
        <select className="select" aria-label="Filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="open">Open (new + reviewing)</option>
          <option value="resolved">Resolved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </select>
      </div>
      {error && <p className="notice notice-bad">{friendlyError(error)}</p>}
      {loading && <Busy />}
      {data && !data.length && (
        <div className="empty">
          <div className="empty-icon">
            <Inbox />
          </div>
          <h3>Nothing here</h3>
          <p>No requests match this filter.</p>
        </div>
      )}
      <div className="requests">
        {data?.map((item) => (
          <RequestCard key={item.id} item={item} onRemove={remove} onChange={(row) => setData((list) => list.map((r) => (r.id === row.id ? row : r)))} />
        ))}
      </div>
    </>
  )
}
