import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Plus, Sparkles, Loader2, Save, Trash2, Upload, Languages, Wrench, ClipboardCheck, CheckCircle2, XCircle, Download, FileCheck2, ShieldCheck, Square, ExternalLink, Wand2, RotateCcw,
} from 'lucide-react'
import { listJobs, getJob, saveJob, deleteJob, searchMovieOptions, aiStatus, aiTranslate, aiProofread, friendlyError } from '../../services/admin.js'
import { Busy, Field, PageHead, useConfirm, useLoader, useToast } from '../../components/admin/ui.jsx'
import SubtitleForm, { QualityReport } from '../../components/admin/SubtitleForm.jsx'
import { parseSubtitle, toSrt, validateCues, autoFix, shiftCues, fixOverlaps, fixDurations, wrapCues, removeEmpty, renumber, sortCues, parseGlossary, formatTime } from '../../lib/srt.js'
import { SOURCE_TYPES, LANGS } from '../../lib/constants.js'
import { timeAgo } from '../../lib/format.js'
import { supabase } from '../../lib/supabase.js'

const CHUNK = 40
const PAGE = 40
const STATUS = {
  draft: ['Draft', ''], translated: ['Translated', 'badge-accent'], needs_review: ['Needs review', 'badge-warn'], approved: ['Approved', 'badge-ok'],
  rejected: ['Rejected', 'badge-bad'], published: ['Published', 'badge-ok'],
}
const STEPS = [
  ['rights', 'Movie & rights', ShieldCheck], ['source', 'Source text', Upload], ['translate', 'Translate', Languages],
  ['qc', 'Timing & QC', Wrench], ['review', 'Review & approve', ClipboardCheck], ['publish', 'Publish', FileCheck2],
]
const slugify = (s) => String(s || 'subtitle').replace(/[^\p{L}\p{N}]+/gu, '.').replace(/^\.+|\.+$/g, '') || 'subtitle'

function downloadText(name, text) {
  // UTF-8 with BOM: many TV / desktop players need the BOM to show Sinhala correctly.
  const url = URL.createObjectURL(new Blob(['\uFEFF' + text], { type: 'application/x-subrip;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

// ---------------------------------------------------------------------------
// Job list + quick checker
// ---------------------------------------------------------------------------
function QuickCheck() {
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const fileRef = useRef(null)
  const run = (value) => {
    const parsed = parseSubtitle(value)
    setResult({ parsed, report: validateCues(parsed.cues, { parseErrors: parsed.errors }) })
  }
  const fix = () => {
    const { cues, changes } = autoFix(result.parsed.cues)
    const next = toSrt(cues)
    setText(next)
    run(next)
    setResult((r) => ({ ...r, changes: changes.length ? changes : ['Nothing needed fixing.'] }))
  }
  return (
    <section className="panel">
      <h2>Quick SRT / VTT checker</h2>
      <p className="hint">Check any subtitle file you made before uploading it to Google Drive. Nothing is saved or sent anywhere — it runs in your browser.</p>
      <textarea className="textarea mono" rows={7} placeholder={'1\n00:00:01,000 --> 00:00:03,000\nසිංහල උපසිරැසිය…'} value={text} onChange={(e) => (setText(e.target.value), setResult(null))} />
      <div className="row-wrap">
        <input ref={fileRef} type="file" accept=".srt,.vtt,text/plain" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const t = await f.text(); setText(t); run(t) } e.target.value = '' }} />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
          <Upload /> Open file
        </button>
        <button type="button" className="btn btn-sm" disabled={!text.trim()} onClick={() => run(text)}>
          <ClipboardCheck /> Check
        </button>
        {result && (
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={fix}>
              <Wand2 /> Auto-fix safe problems
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadText('checked.srt', toSrt(result.parsed.cues))}>
              <Download /> Download .srt
            </button>
          </>
        )}
      </div>
      {result?.changes && <p className="notice notice-ok">{result.changes.join(' · ')}</p>}
      {result && <QualityReport report={result.report} />}
    </section>
  )
}

function JobList() {
  const navigate = useNavigate()
  const toast = useToast()
  const { data, error, loading } = useLoader(listJobs, [])
  const [creating, setCreating] = useState(false)
  async function create() {
    setCreating(true)
    try {
      const job = await saveJob(null, { title: 'New subtitle job' })
      navigate(`/admin/ai/${job.id}/`)
    } catch (err) {
      toast(friendlyError(err), 'bad')
      setCreating(false)
    }
  }
  return (
    <>
      <PageHead title="AI Studio" sub="Create Sinhala subtitles from material you are allowed to use. AI writes a draft; a person checks and approves it. Nothing is published automatically.">
        <button type="button" className="btn btn-sm" onClick={create} disabled={creating}>
          {creating ? <Loader2 className="spin" /> : <Plus />} New subtitle job
        </button>
      </PageHead>
      {error && <p className="notice notice-bad">{friendlyError(error)}</p>}
      {loading && <Busy />}
      {data && (
        <section className="panel">
          <h2>Jobs</h2>
          {!data.length && <p className="muted pad">No jobs yet. A job takes one film from source text to an approved Sinhala .srt file.</p>}
          {data.length > 0 && (
            <ul className="mini-list">
              {data.map((j) => {
                const [label, tone] = STATUS[j.status] || STATUS.draft
                return (
                  <li key={j.id}>
                    <Link to={`/admin/ai/${j.id}/`}>
                      <strong>{j.movie?.title || j.title || `Job #${j.id}`}</strong> {j.movie?.release_year ? <span className="dim">({j.movie.release_year})</span> : null}
                      <small>
                        {SOURCE_TYPES[j.source_type]?.label}
                        {j.rights_confirmed ? '' : ' · rights not confirmed'}
                        {j.quality_report?.summary ? ` · QC ${j.quality_report.summary.score}/100` : ''}
                      </small>
                    </Link>
                    <span className={`badge ${tone}`}>{label}</span>
                    <span className="mini-meta">{timeAgo(j.updated_at)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}
      <QuickCheck />
    </>
  )
}

// ---------------------------------------------------------------------------
// One job
// ---------------------------------------------------------------------------
function MoviePicker({ movie, onPick }) {
  const [q, setQ] = useState('')
  const [options, setOptions] = useState(null)
  useEffect(() => {
    if (movie) return
    let alive = true
    const t = setTimeout(() => searchMovieOptions(q).then((rows) => alive && setOptions(rows), () => alive && setOptions([])), 250)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [q, movie])
  if (movie)
    return (
      <div className="picked">
        <span>
          <strong>{movie.title}</strong> {movie.release_year ? `(${movie.release_year})` : ''} · {LANGS[movie.language]?.en || movie.language}
          {movie.tmdb_id ? ` · TMDB #${movie.tmdb_id}` : ''}
        </span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onPick(null)}>
          Change
        </button>
      </div>
    )
  return (
    <div>
      <input className="input" placeholder="Search your movies…" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="options">
        {options?.map((m) => (
          <li key={m.id}>
            <button type="button" onClick={() => onPick(m)}>
              <strong>{m.title}</strong> <span className="dim">{m.release_year || ''}</span>
            </button>
          </li>
        ))}
        {options && !options.length && (
          <li className="muted pad">
            No movie found. <Link to="/admin/movies/new/">Add the movie first</Link>, then come back.
          </li>
        )}
      </ul>
    </div>
  )
}

function JobEditor({ id }) {
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const [job, setJob] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [step, setStep] = useState('rights')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const [sourceText, setSourceText] = useState('')
  const [cues, setCues] = useState([]) // Sinhala cues being worked on
  const [report, setReport] = useState(null)
  const [ai, setAi] = useState(undefined)
  const [progress, setProgress] = useState(null) // { done, total }
  const [page, setPage] = useState(0)
  const [shiftMs, setShiftMs] = useState(0)
  const [fixes, setFixes] = useState(null)
  const [proofing, setProofing] = useState(false)
  const [entry, setEntry] = useState(false)
  const stop = useRef(false)
  const fileRef = useRef(null)
  const sinhalaFileRef = useRef(null)

  useEffect(() => {
    let alive = true
    getJob(id)
      .then((row) => {
        if (!alive) return
        if (!row) return setLoadError('This job does not exist.')
        setJob(row)
        setSourceText(row.source_srt || '')
        setCues(row.sinhala_srt ? parseSubtitle(row.sinhala_srt).cues : [])
        setReport(row.quality_report || null)
        setStep(row.status === 'approved' || row.status === 'published' ? 'publish' : row.sinhala_srt ? 'review' : row.source_srt ? 'translate' : 'rights')
      })
      .catch((err) => alive && setLoadError(friendlyError(err)))
    aiStatus().then((s) => alive && setAi(s), (e) => alive && setAi({ configured: false, error: e.message }))
    return () => {
      alive = false
      stop.current = true
    }
  }, [id])

  const source = useMemo(() => parseSubtitle(sourceText), [sourceText])
  const glossary = useMemo(() => parseGlossary(job?.glossary), [job?.glossary])
  const aligned = source.cues.length > 0 && source.cues.length === cues.length
  const translatedCount = cues.filter((c) => c.text.trim()).length
  const locked = job?.status === 'approved' || job?.status === 'published'
  const patch = (values) => (setJob((j) => ({ ...j, ...values })), setDirty(true))

  const check = (list = cues) => {
    const next = validateCues(list, { source: aligned || list.length === source.cues.length ? source.cues : null, glossary, lang: 'si' })
    setReport(next)
    return next
  }

  /** Any change to the Sinhala text after approval sends the job back to review. */
  function editCues(next) {
    setCues(next)
    setDirty(true)
    setReport(null)
    if (locked) setJob((j) => ({ ...j, status: 'needs_review', approved_at: null, approved_by: null }))
  }

  async function persist(extra = {}, message = 'Saved.') {
    setSaving(true)
    try {
      const sinhala = cues.length ? toSrt(cues) : null
      const row = await saveJob(id, {
        movie_id: job.movie?.id ?? null, title: job.movie?.title || job.title || '', source_type: job.source_type, source_reference: job.source_reference?.trim() || null,
        rights_confirmed: job.rights_confirmed, glossary: job.glossary || null, source_srt: sourceText || null, sinhala_srt: sinhala, quality_report: report,
        status: job.status, approved_at: job.approved_at, approved_by: job.approved_by, ...extra,
      })
      setJob(row)
      setDirty(false)
      if (message) toast(message)
      return row
    } catch (err) {
      toast(friendlyError(err), 'bad')
      return null
    } finally {
      setSaving(false)
    }
  }

  // ---- translate ----
  async function translate() {
    if (!job.rights_confirmed) return toast('Confirm the rights in step 1 first.', 'bad')
    if (!source.cues.length) return toast('Add the source text in step 2 first.', 'bad')
    let work = aligned ? cues.map((c) => ({ ...c })) : source.cues.map((c) => ({ ...c, text: '' }))
    const todo = work.map((c, i) => i).filter((i) => !work[i].text.trim() && source.cues[i].text.trim())
    if (!todo.length) return toast('Every cue already has a translation. Clear a cue to translate it again.', 'info')
    stop.current = false
    setProgress({ done: 0, total: todo.length })
    const context = [job.movie?.title, job.movie?.release_year, LANGS[job.movie?.language]?.en].filter(Boolean).join(', ')
    let done = 0
    try {
      for (let at = 0; at < todo.length && !stop.current; at += CHUNK) {
        const batch = todo.slice(at, at + CHUNK)
        const first = batch[0]
        const previous = work.slice(Math.max(0, first - 4), first).filter((c) => c.text.trim()).map((c) => c.text)
        const res = await aiTranslate({
          rights_confirmed: true, context, glossary: job.glossary || '', source_lang: job.movie?.language || 'auto', previous,
          cues: batch.map((i) => ({ id: i + 1, text: source.cues[i].text })),
        })
        const byId = new Map((res.cues || []).map((c) => [Number(c.id), String(c.text || '')]))
        work = work.map((c, i) => (byId.has(i + 1) ? { ...c, text: byId.get(i + 1) } : c))
        done += batch.length
        setCues(work)
        setDirty(true)
        setProgress({ done, total: todo.length })
      }
      const missing = work.filter((c, i) => !c.text.trim() && source.cues[i].text.trim()).length
      toast(stop.current ? 'Stopped. Press Translate again to continue where it left off.' : missing ? `Done, but ${missing} cues came back empty — press Translate again to retry them.` : 'Translation draft finished. Now check timing and quality.', missing || stop.current ? 'info' : 'ok')
    } catch (err) {
      toast(`${err.message} — progress so far is kept; press Translate again to continue.`, 'bad')
    } finally {
      setProgress(null)
      setReport(null)
      setJob((j) => ({ ...j, status: j.status === 'draft' || j.status === 'rejected' ? 'translated' : j.status === 'approved' || j.status === 'published' ? 'needs_review' : j.status }))
    }
  }

  // ---- QC tools ----
  const tool = (label, fn) => () => {
    const next = renumber(fn(cues))
    editCues(next)
    check(next)
    toast(label, 'info')
  }
  function runAutoFix() {
    const { cues: next, changes } = autoFix(cues)
    editCues(next)
    check(next)
    toast(changes.length ? changes.join(' · ') : 'Nothing needed fixing.', 'info')
  }
  async function proofread() {
    const slice = cues.slice(page * PAGE, page * PAGE + PAGE).map((c, i) => ({ id: page * PAGE + i + 1, text: c.text })).filter((c) => c.text.trim())
    if (!slice.length) return
    setProofing(true)
    try {
      const res = await aiProofread(slice)
      setFixes((res.fixes || []).filter((f) => cues[f.id - 1] && f.text && f.text !== cues[f.id - 1].text))
      if (!res.fixes?.length) toast('AI found nothing to correct on this page.', 'info')
    } catch (err) {
      toast(err.message, 'bad')
    } finally {
      setProofing(false)
    }
  }
  const applyFix = (fix) => {
    editCues(cues.map((c, i) => (i === fix.id - 1 ? { ...c, text: fix.text } : c)))
    setFixes((list) => list.filter((f) => f.id !== fix.id))
  }

  // ---- approve / reject ----
  async function approve() {
    const fresh = check()
    if (!job.rights_confirmed) return toast('Confirm the rights in step 1 first.', 'bad')
    if (fresh.summary.errors > 0) return toast(`Fix the ${fresh.summary.errors} error(s) in the quality report first.`, 'bad')
    const ok = await confirm({
      title: 'Approve this subtitle?',
      message: 'By approving you confirm that you read the Sinhala text yourself, the meaning is right, and you have the right to publish it. Approval does not publish anything — you still upload the file and switch it on.',
      confirmLabel: 'I checked it — approve',
    })
    if (!ok) return
    const { data } = await supabase.auth.getUser()
    const row = await persist({ status: 'approved', approved_at: new Date().toISOString(), approved_by: data?.user?.id ?? null, quality_report: fresh }, 'Approved. Continue to Publish.')
    if (row) setStep('publish')
  }
  const reject = () => persist({ status: 'rejected', approved_at: null, approved_by: null }, 'Marked as rejected.')

  async function remove() {
    const ok = await confirm({ title: 'Delete this job?', message: 'The source text and the Sinhala draft stored in this job are deleted. Subtitle entries already created are not affected.', confirmLabel: 'Delete job', danger: true })
    if (!ok) return
    try {
      await deleteJob(id)
      navigate('/admin/ai/')
    } catch (err) {
      toast(friendlyError(err), 'bad')
    }
  }

  if (loadError)
    return (
      <>
        <p className="notice notice-bad">{loadError}</p>
        <Link className="btn btn-ghost" to="/admin/ai/">
          <ArrowLeft /> Back
        </Link>
      </>
    )
  if (!job) return <Busy />

  const [statusLabel, statusTone] = STATUS[job.status] || STATUS.draft
  const pages = Math.max(1, Math.ceil(cues.length / PAGE))
  const view = cues.slice(page * PAGE, page * PAGE + PAGE)
  const sourceFor = (i) => (aligned ? source.cues[i]?.text : '')
  const fileName = `${slugify(job.movie?.title || job.title)}${job.movie?.release_year ? '.' + job.movie.release_year : ''}.si.srt`

  const pager = pages > 1 && (
    <div className="pager">
      <button type="button" className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
        Previous
      </button>
      <span className="muted">
        Cues {page * PAGE + 1}–{Math.min(cues.length, page * PAGE + PAGE)} of {cues.length}
      </span>
      <button type="button" className="btn btn-ghost btn-sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
        Next
      </button>
    </div>
  )

  return (
    <>
      <PageHead title={job.movie?.title || job.title || `Job #${job.id}`} sub={`Subtitle job #${job.id}${dirty ? ' · unsaved changes' : ''}`}>
        <span className={`badge ${statusTone}`}>{statusLabel}</span>
        <Link className="btn btn-ghost btn-sm" to="/admin/ai/">
          <ArrowLeft /> Jobs
        </Link>
        <button type="button" className="btn btn-sm" disabled={saving} onClick={() => persist()}>
          {saving ? <Loader2 className="spin" /> : <Save />} Save
        </button>
      </PageHead>

      <nav className="steps-nav" aria-label="Steps">
        {STEPS.map(([key, label, Icon], n) => (
          <button key={key} type="button" className={step === key ? 'is-active' : ''} aria-current={step === key ? 'step' : undefined} onClick={() => setStep(key)}>
            <span className="step-n">{n + 1}</span>
            <Icon size={16} aria-hidden="true" /> {label}
          </button>
        ))}
      </nav>

      {step === 'rights' && (
        <section className="panel">
          <h2>1 · Which film, and what are you allowed to use?</h2>
          <div className="form-grid">
            <Field label="Movie" className="span-4" hint="Identified by title, year, language and TMDB ID from your library.">
              <MoviePicker movie={job.movie} onPick={(m) => patch({ movie: m, movie_id: m?.id ?? null, title: m?.title || job.title })} />
            </Field>
            <Field label="Where does the dialogue text come from?" className="span-2">
              <select className="select" value={job.source_type} onChange={(e) => patch({ source_type: e.target.value })}>
                {Object.entries(SOURCE_TYPES).map(([key, s]) => (
                  <option key={key} value={key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Source reference / proof" className="span-2" hint="A link or note: licence URL, who gave permission and when, or “transcribed by me from my own copy”.">
              <input className="input" value={job.source_reference || ''} onChange={(e) => patch({ source_reference: e.target.value })} />
            </Field>
          </div>
          <div className="notice">
            <ShieldCheck />
            <div>
              <strong>Lawful sources only.</strong>
              <ul className="plain-list">
                <li>Text you wrote or transcribed yourself (for example with <code>tools/transcribe.py</code> on audio you are allowed to use).</li>
                <li>
                  Public-domain or openly licensed films — check the licence on the page itself:{' '}
                  <a href="https://archive.org/details/feature_films" target="_blank" rel="noopener noreferrer">Internet Archive</a>,{' '}
                  <a href="https://commons.wikimedia.org/wiki/Commons:Timed_Text" target="_blank" rel="noopener noreferrer">Wikimedia Commons TimedText</a>.
                </li>
                <li>Subtitles the translator or rights holder gave you written permission to use.</li>
              </ul>
              <p>Do not paste subtitles taken from other subtitle sites or ripped from streaming services. This tool does not download or search for them.</p>
            </div>
          </div>
          <label className="check">
            <input type="checkbox" checked={job.rights_confirmed} onChange={(e) => patch({ rights_confirmed: e.target.checked, ...(e.target.checked ? {} : locked ? { status: 'needs_review', approved_at: null, approved_by: null } : {}) })} />
            <span>
              <strong>I confirm</strong> I created this source text myself, or I hold permission / a licence that allows translating and publishing it, and I recorded the proof above.
            </span>
          </label>
          <div className="save-bar">
            <button type="button" className="btn btn-danger btn-sm" onClick={remove}>
              <Trash2 /> Delete job
            </button>
            <span className="spacer" />
            <button type="button" className="btn" disabled={saving} onClick={async () => (await persist()) && setStep('source')}>
              <Save /> Save &amp; continue
            </button>
          </div>
        </section>
      )}

      {step === 'source' && (
        <section className="panel">
          <h2>2 · Source subtitle text (with timing)</h2>
          <p className="hint">Paste or open the .srt / .vtt you are allowed to use — usually the original-language or English dialogue. Already have a Sinhala file you translated yourself? Use “Open Sinhala file” in step 3 instead.</p>
          <textarea className="textarea mono" rows={14} value={sourceText} onChange={(e) => (setSourceText(e.target.value), setDirty(true))} placeholder={'1\n00:00:01,000 --> 00:00:03,000\nHello there.'} />
          <div className="row-wrap">
            <input ref={fileRef} type="file" accept=".srt,.vtt,text/plain" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setSourceText(await f.text()); setDirty(true) } e.target.value = '' }} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
              <Upload /> Open file
            </button>
            <span className={`badge ${source.errors.length ? 'badge-warn' : source.cues.length ? 'badge-ok' : ''}`}>
              {source.cues.length} cues{source.errors.length ? ` · ${source.errors.length} syntax problem(s)` : ''}
            </span>
          </div>
          {source.errors.slice(0, 5).map((e, i) => (
            <p key={i} className="hint hint-bad">
              Line {e.line}: {e.message}
            </p>
          ))}
          <div className="save-bar">
            <span className="spacer" />
            <button type="button" className="btn" disabled={saving || !source.cues.length} onClick={async () => (await persist()) && setStep('translate')}>
              <Save /> Save &amp; continue
            </button>
          </div>
        </section>
      )}

      {step === 'translate' && (
        <section className="panel">
          <h2>3 · Translate to Sinhala</h2>
          {ai === undefined && <Busy label="Checking AI…" />}
          {ai && !ai.configured && (
            <p className="notice notice-warn">
              AI translation is not available: {ai.error || 'GEMINI_API_KEY is not set'}. You can still translate by hand in step 5, or open a Sinhala file you made. See README → “AI (optional)”.
            </p>
          )}
          {ai?.configured && <p className="hint">AI model: {ai.model}. Free tier has daily limits — if it stops, wait and press Translate again; finished cues are kept.</p>}
          <Field label="Names & terms (glossary)" hint="One per line: English = සිංහල. Keeps names spelled the same way everywhere.">
            <textarea className="textarea mono" rows={4} placeholder={'Vikram = වික්‍රම්\nInspector = පරීක්ෂක'} value={job.glossary || ''} onChange={(e) => patch({ glossary: e.target.value })} />
          </Field>
          <div className="row-wrap">
            {progress ? (
              <button type="button" className="btn btn-danger btn-sm" onClick={() => (stop.current = true)}>
                <Square /> Stop
              </button>
            ) : (
              <button type="button" className="btn" disabled={!ai?.configured || !source.cues.length || !job.rights_confirmed} onClick={translate}>
                <Sparkles /> {translatedCount && aligned ? 'Continue translating' : 'Translate with AI'}
              </button>
            )}
            <input ref={sinhalaFileRef} type="file" accept=".srt,.vtt,text/plain" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const p = parseSubtitle(await f.text()); editCues(p.cues); toast(`${p.cues.length} Sinhala cues loaded.`, 'info') } e.target.value = '' }} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => sinhalaFileRef.current?.click()}>
              <Upload /> Open Sinhala file
            </button>
            {source.cues.length > 0 && !cues.length && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => (editCues(source.cues.map((c) => ({ ...c, text: '' }))), setStep('review'))}>
                Translate by hand
              </button>
            )}
            <span className="badge">
              {translatedCount} / {source.cues.length || cues.length} cues translated
            </span>
          </div>
          {!job.rights_confirmed && <p className="hint hint-bad">Confirm the rights in step 1 to enable translation.</p>}
          {progress && (
            <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
              <span style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
              <em>
                {progress.done} / {progress.total}
              </em>
            </div>
          )}
          <div className="save-bar">
            <span className="spacer" />
            <button type="button" className="btn" disabled={saving || !cues.length || Boolean(progress)} onClick={async () => (await persist()) && setStep('qc')}>
              <Save /> Save &amp; continue
            </button>
          </div>
        </section>
      )}

      {step === 'qc' && (
        <section className="panel">
          <h2>4 · Timing &amp; quality check</h2>
          {!cues.length ? (
            <p className="muted pad">There is no Sinhala text yet — go back to step 3.</p>
          ) : (
            <>
              <div className="row-wrap">
                <button type="button" className="btn btn-sm" onClick={() => check()}>
                  <ClipboardCheck /> Run quality check
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={runAutoFix}>
                  <Wand2 /> Auto-fix safe problems
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={tool('Overlaps removed.', (c) => fixOverlaps(sortCues(c)))}>
                  Fix overlaps
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={tool('Durations adjusted.', (c) => fixDurations(c))}>
                  Fix durations
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={tool('Lines re-wrapped.', (c) => wrapCues(c))}>
                  Re-wrap lines
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={tool('Empty cues removed.', (c) => removeEmpty(c))}>
                  Remove empty
                </button>
              </div>
              <div className="row-wrap">
                <label className="inline-field">
                  Shift all cues by
                  <input className="input" type="number" step="50" value={shiftMs} onChange={(e) => setShiftMs(Number(e.target.value))} /> ms
                </label>
                <button type="button" className="btn btn-ghost btn-sm" disabled={!shiftMs} onClick={tool(`Shifted by ${shiftMs} ms.`, (c) => shiftCues(c, shiftMs))}>
                  Apply shift
                </button>
                <span className="hint">Positive = later, negative = earlier. Check against the video before approving.</span>
              </div>
              {report ? <QualityReport report={report} /> : <p className="hint">Run the quality check to see syntax, timing order, overlaps, missing text, reading speed, long gaps and consistency.</p>}
              <div className="save-bar">
                <span className="spacer" />
                <button type="button" className="btn" disabled={saving} onClick={async () => { const r = report || check(); (await persist({ quality_report: r })) && setStep('review') }}>
                  <Save /> Save &amp; continue
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {step === 'review' && (
        <section className="panel">
          <div className="panel-head">
            <h2>5 · Read every line, then approve</h2>
            <button type="button" className="btn btn-ghost btn-sm" disabled={proofing || !ai?.configured || !view.length} onClick={proofread} title="Spelling and grammar suggestions for the cues on this page">
              {proofing ? <Loader2 className="spin" /> : <Sparkles />} AI proofread this page
            </button>
          </div>
          {!cues.length ? (
            <p className="muted pad">There is no Sinhala text yet — go back to step 3.</p>
          ) : (
            <>
              {fixes?.length > 0 && (
                <div className="fixes">
                  <strong>AI suggestions — accept only the ones you agree with:</strong>
                  {fixes.map((f) => (
                    <div key={f.id} className="fix">
                      <span className="qc-cue">#{f.id}</span>
                      <div>
                        <del lang="si">{cues[f.id - 1]?.text}</del>
                        <ins lang="si">{f.text}</ins>
                        {f.note && <small>{f.note}</small>}
                      </div>
                      <button type="button" className="btn btn-sm" onClick={() => applyFix(f)}>
                        Accept
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFixes((l) => l.filter((x) => x.id !== f.id))}>
                        Ignore
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {pager}
              <div className="cue-editor">
                {view.map((c, n) => {
                  const i = page * PAGE + n
                  const flagged = report?.issues?.find((x) => x.cue === i + 1 && x.severity !== 'info')
                  return (
                    <div key={i} className={`cue ${flagged ? `cue-${flagged.severity}` : ''}`}>
                      <div className="cue-meta">
                        <strong>#{i + 1}</strong>
                        <span>{formatTime(c.start)}</span>
                        <span>{formatTime(c.end)}</span>
                      </div>
                      {aligned && <p className="cue-src">{sourceFor(i)}</p>}
                      <textarea className="textarea" lang="si" rows={2} aria-label={`Sinhala text for cue ${i + 1}`} value={c.text} onChange={(e) => editCues(cues.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))} />
                      {flagged && <small className="cue-flag">{flagged.message}</small>}
                    </div>
                  )
                })}
              </div>
              {pager}
              <div className="save-bar">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => check()}>
                  <RotateCcw /> Re-check
                </button>
                {report && (
                  <span className={`badge ${report.summary.errors ? 'badge-bad' : report.summary.verdict === 'pass' ? 'badge-ok' : 'badge-warn'}`}>
                    {report.summary.errors} errors · {report.summary.warnings} warnings · {report.summary.score}/100
                  </span>
                )}
                <span className="spacer" />
                <button type="button" className="btn btn-ghost btn-sm" disabled={saving} onClick={reject}>
                  <XCircle /> Reject
                </button>
                <button type="button" className="btn" disabled={saving || job.status === 'approved' || job.status === 'published'} onClick={approve}>
                  <CheckCircle2 /> {locked ? 'Approved' : 'Approve'}
                </button>
              </div>
              {!job.rights_confirmed && <p className="hint hint-bad">Approval is blocked until the rights are confirmed in step 1.</p>}
            </>
          )}
        </section>
      )}

      {step === 'publish' && (
        <section className="panel">
          <h2>6 · Publish (you do this — nothing is automatic)</h2>
          {!locked ? (
            <p className="notice notice-warn">This job is not approved yet. Finish step 5 first.</p>
          ) : (
            <ol className="publish-steps">
              <li>
                <strong>Download the approved file.</strong>
                <button type="button" className="btn btn-sm" onClick={() => downloadText(fileName, toSrt(cues))}>
                  <Download /> {fileName}
                </button>
              </li>
              <li>
                <span><strong>Upload it to your Google Drive</strong> and share it: right-click → Share → General access → “Anyone with the link” (Viewer) → Copy link.</span>
                <a className="btn btn-ghost btn-sm" href="https://drive.google.com/drive/my-drive" target="_blank" rel="noopener noreferrer">
                  <ExternalLink /> Open Google Drive
                </a>
              </li>
              <li>
                <span><strong>Create the subtitle entry</strong>, paste the link, press “Verify link”, then tick “Published”.</span>
                {job.movie ? (
                  <button type="button" className="btn btn-sm" onClick={() => setEntry(true)}>
                    <Plus /> Create subtitle entry
                  </button>
                ) : (
                  <span className="hint hint-bad">Choose the movie in step 1 first.</span>
                )}
              </li>
            </ol>
          )}
          {job.status === 'published' && <p className="notice notice-ok">A subtitle entry was created from this job. Manage it under Subtitles.</p>}
        </section>
      )}

      {entry && job.movie && (
        <SubtitleForm
          movie={job.movie}
          subtitle={null}
          defaults={{ language: 'si', format: 'srt', permission_status: SOURCE_TYPES[job.source_type]?.permission || 'pending_review', permission_note: job.source_reference || '', description: 'AI-assisted translation, reviewed and approved by an editor.' }}
          onClose={() => setEntry(false)}
          onSaved={async () => {
            setEntry(false)
            await persist({ status: 'published' }, 'Subtitle entry created.')
          }}
        />
      )}
    </>
  )
}

export default function AiStudio() {
  const { id } = useParams()
  return id ? <JobEditor key={id} id={id} /> : <JobList />
}
