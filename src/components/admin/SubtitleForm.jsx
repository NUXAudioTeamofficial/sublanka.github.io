import { useMemo, useState } from 'react'
import { Loader2, ShieldCheck, FileSearch, Save, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react'
import { Modal, Field, useToast } from './ui.jsx'
import { saveSubtitle, driveCheck, friendlyError } from '../../services/admin.js'
import { parseDriveId, driveDownloadUrl, driveViewUrl } from '../../lib/drive.js'
import { parseSubtitle, validateCues, formatTime } from '../../lib/srt.js'
import { FORMATS, PERMISSIONS, LANGS } from '../../lib/constants.js'

const REASONS = {
  private: 'The file is private. In Google Drive: Share → General access → “Anyone with the link” → Viewer.',
  not_found: 'Google Drive says this file does not exist. Check the link.',
  rate_limited: 'Google is rate-limiting checks right now. Wait a minute and try again, or confirm manually.',
  quota: 'Google reports the download quota for this file is exceeded. Try later.',
}

export function QualityReport({ report, compact = false }) {
  if (!report) return null
  const { summary, issues } = report
  const tone = summary.verdict === 'pass' ? 'ok' : summary.verdict === 'review' ? 'warn' : 'bad'
  const shown = compact ? issues.slice(0, 8) : issues.slice(0, 200)
  return (
    <div className="qc">
      <div className={`qc-head qc-${tone}`}>
        <strong>{summary.verdict === 'pass' ? 'Passed' : summary.verdict === 'review' ? 'Needs review' : 'Has errors'}</strong>
        <span>Score {summary.score}/100</span>
        <span>{summary.cues} cues</span>
        <span>{formatTime(summary.duration).slice(0, 8)} long</span>
        <span>{summary.errors} errors</span>
        <span>{summary.warnings} warnings</span>
        <span>{summary.sinhalaRatio}% Sinhala text</span>
      </div>
      {shown.length > 0 && (
        <ul className="qc-list">
          {shown.map((i, n) => (
            <li key={n} className={`qc-${i.severity}`}>
              <span className="qc-sev">{i.severity}</span>
              {i.cue ? <span className="qc-cue">#{i.cue}</span> : null}
              <span>{i.message}</span>
            </li>
          ))}
        </ul>
      )}
      {issues.length > shown.length && <p className="hint">…and {issues.length - shown.length} more.</p>}
      {!issues.length && <p className="hint">No problems found by the automatic checks. A human read-through is still required.</p>}
    </div>
  )
}

export default function SubtitleForm({ movie, subtitle, defaults = {}, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState(() => ({
    language: 'si', format: 'srt', version: '', translator: '', description: '', permission_status: 'pending_review', permission_note: '', published: false,
    ...defaults,
    ...(subtitle
      ? {
          language: subtitle.language, format: subtitle.format, version: subtitle.version || '', translator: subtitle.translator || '', description: subtitle.description || '',
          permission_status: subtitle.permission_status, permission_note: subtitle.permission_note || '', published: subtitle.published,
        }
      : {}),
  }))
  const [link, setLink] = useState(subtitle?.drive_url || (subtitle?.drive_file_id ? driveViewUrl(subtitle.drive_file_id) : ''))
  // verification state belongs to ONE file id; changing the link clears it
  const [verified, setVerified] = useState(subtitle?.link_verified_at ? { id: subtitle.drive_file_id, status: subtitle.link_status, at: subtitle.link_verified_at } : null)
  const [check, setCheck] = useState(null)
  const [manual, setManual] = useState(false)
  const [checking, setChecking] = useState('')
  const [report, setReport] = useState(null)
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)

  const fileId = useMemo(() => parseDriveId(link), [link])
  const linkBad = Boolean(link.trim()) && !fileId
  const isVerified = Boolean(fileId && verified && verified.id === fileId)
  const publishable = PERMISSIONS[form.permission_status]?.publishable
  const canPublish = Boolean(fileId && (isVerified || manual) && publishable)
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function run(wantText) {
    if (!fileId) return
    setChecking(wantText ? 'preview' : 'verify')
    setCheck(null)
    try {
      const res = await driveCheck(fileId, wantText)
      setCheck(res)
      if (res.accessible) {
        setVerified({ id: fileId, status: 'ok', at: new Date().toISOString() })
        const ext = (res.filename || '').toLowerCase().match(/\.(srt|vtt|ass|zip)$/)
        if (ext && !subtitle) setForm((f) => ({ ...f, format: ext[1] }))
      } else if (verified?.id === fileId) setVerified(null)
      if (wantText) {
        if (res.text) {
          const parsed = parseSubtitle(res.text)
          setReport(validateCues(parsed.cues, { parseErrors: parsed.errors, lang: form.language }))
          setPreview(parsed.cues.slice(0, 6))
        } else {
          setReport(null)
          setPreview(null)
          if (res.accessible) toast(res.encoding === 'not-utf8' ? 'The file is not UTF-8 text, so Sinhala letters would show as garbage. Re-save it as UTF-8.' : 'This file type cannot be previewed (ZIP / too large). The link itself works.', 'info')
        }
      }
    } catch (err) {
      setCheck({ accessible: false, reason: 'error', message: err.message })
    } finally {
      setChecking('')
    }
  }

  async function submit(e) {
    e.preventDefault()
    if (linkBad) return toast('That is not a Google Drive file link.', 'bad')
    const values = { ...form, movie_id: movie.id, drive_file_id: fileId || '', drive_url: fileId ? link.trim() : '' }
    if (fileId && isVerified) {
      values.link_status = verified.status
      values.link_verified_at = verified.at
    } else if (fileId && manual) {
      values.link_status = 'manual'
      values.link_verified_at = new Date().toISOString()
    } else {
      values.link_status = 'unverified'
      values.link_verified_at = null
    }
    if (!canPublish) values.published = false
    setSaving(true)
    try {
      const row = await saveSubtitle(subtitle?.id, values)
      toast(row.published ? 'Saved — the subtitle is live.' : 'Saved (not public yet).')
      onSaved(row)
    } catch (err) {
      toast(friendlyError(err), 'bad')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      wide
      title={`${subtitle ? 'Edit' : 'Add'} subtitle — ${movie.title}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" form="subtitle-form" disabled={saving}>
            {saving ? <Loader2 className="spin" /> : <Save />} Save
          </button>
        </>
      }
    >
      <form id="subtitle-form" className="form-grid" onSubmit={submit}>
        <Field label="Google Drive link or file ID *" className="span-4" error={linkBad ? 'Not a Drive file link. Folder links do not work — share the file itself.' : ''} hint="Drive → right-click the file → Share → General access: “Anyone with the link” (Viewer) → Copy link.">
          <input className="input" required placeholder="https://drive.google.com/file/d/…/view?usp=sharing" value={link} onChange={(e) => (setLink(e.target.value), setCheck(null), setManual(false))} />
        </Field>
        <div className="span-4 row-wrap">
          <button type="button" className="btn btn-sm" disabled={!fileId || Boolean(checking)} onClick={() => run(false)}>
            {checking === 'verify' ? <Loader2 className="spin" /> : <ShieldCheck />} Verify link
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={!fileId || Boolean(checking)} onClick={() => run(true)}>
            {checking === 'preview' ? <Loader2 className="spin" /> : <FileSearch />} Preview &amp; validate
          </button>
          {fileId && (
            <a className="btn btn-ghost btn-sm" href={driveDownloadUrl(fileId)} target="_blank" rel="noopener noreferrer">
              <ExternalLink /> Test download
            </a>
          )}
          {isVerified && !check && (
            <span className="badge badge-ok">
              <CheckCircle2 /> {verified.status === 'manual' ? 'Confirmed manually' : 'Verified'}
            </span>
          )}
        </div>
        {check && (
          <div className={`span-4 notice ${check.accessible ? 'notice-ok' : 'notice-bad'}`}>
            {check.accessible ? <CheckCircle2 /> : <AlertTriangle />}
            <div>
              {check.accessible ? (
                <>
                  <strong>Public download works.</strong> {check.filename ? `File: ${check.filename}` : ''}
                  {check.size ? ` · ${(check.size / 1024).toFixed(1)} KB` : ''}
                  {check.note === 'large_file' ? ' · Google shows a “can’t scan for viruses” page first for large files.' : ''}
                </>
              ) : (
                <>
                  <strong>Not downloadable by the public.</strong> {REASONS[check.reason] || check.message || 'The check failed.'}
                </>
              )}
            </div>
          </div>
        )}
        {fileId && !isVerified && (
          <label className="check span-4">
            <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} />
            <span>I opened “Test download” in a private/incognito window and the file downloaded without signing in. (Use this only if the automatic check cannot run.)</span>
          </label>
        )}
        {preview && (
          <div className="span-4">
            <pre className="srt-preview" lang={form.language}>
              {preview.map((c) => `${formatTime(c.start)} --> ${formatTime(c.end)}\n${c.text}`).join('\n\n')}
            </pre>
            <QualityReport report={report} compact />
          </div>
        )}

        <Field label="Subtitle language">
          <select className="select" value={form.language} onChange={set('language')}>
            {Object.entries(LANGS).map(([code, l]) => (
              <option key={code} value={code}>
                {l.en}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Format">
          <select className="select" value={form.format} onChange={set('format')}>
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {f.toUpperCase()}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Version / release" hint="The video release the timing matches." className="span-2">
          <input className="input" placeholder="e.g. WEB-DL 1080p" value={form.version} onChange={set('version')} />
        </Field>
        <Field label="Translator / credit" className="span-2">
          <input className="input" value={form.translator} onChange={set('translator')} />
        </Field>
        <Field label="Short note for visitors" className="span-2">
          <input className="input" lang="si" value={form.description} onChange={set('description')} />
        </Field>
        <Field label="Rights status *" hint={PERMISSIONS[form.permission_status]?.hint} className="span-2">
          <select className="select" value={form.permission_status} onChange={set('permission_status')}>
            {Object.entries(PERMISSIONS).map(([key, p]) => (
              <option key={key} value={key}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Source / permission note" hint="Who made it, or who allowed it. Keep proof (email, licence link) somewhere safe." className="span-2">
          <input className="input" value={form.permission_note} onChange={set('permission_note')} />
        </Field>

        <label className={`check span-4 ${canPublish ? '' : 'is-disabled'}`}>
          <input type="checkbox" checked={canPublish && form.published} disabled={!canPublish} onChange={set('published')} />
          <span>
            <strong>Published</strong> — visitors can download it.
            {!canPublish && <em> Needs: {[!fileId && 'a Drive file', fileId && !(isVerified || manual) && 'a verified link', !publishable && 'a publishable rights status'].filter(Boolean).join(', ')}.</em>}
          </span>
        </label>
      </form>
    </Modal>
  )
}
