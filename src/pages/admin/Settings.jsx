import { useEffect, useState } from 'react'
import { Save, Loader2, Plus, Trash2, KeyRound, CheckCircle2, XCircle } from 'lucide-react'
import { getSettingsAdmin, saveSettings, changePassword, tmdbStatus, aiStatus, friendlyError } from '../../services/admin.js'
import { Busy, Field, PageHead, useToast } from '../../components/admin/ui.jsx'
import { useSettings } from '../../context/SettingsContext.jsx'
import { DEFAULT_SETTINGS } from '../../services/settings.js'
import { LANGS } from '../../lib/constants.js'

function Service({ name, state, hint }) {
  return (
    <li>
      {state === undefined ? <Loader2 className="spin" size={17} /> : state?.configured ? <CheckCircle2 size={17} className="ok" /> : <XCircle size={17} className="bad" />}
      <span>
        <strong>{name}</strong> — {state === undefined ? 'checking…' : state?.configured ? `connected${state.model ? ` (${state.model})` : ''}` : state?.error || 'not configured'}
        <small>{hint}</small>
      </span>
    </li>
  )
}

export default function Settings() {
  const toast = useToast()
  const { reload } = useSettings()
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [pw, setPw] = useState({ a: '', b: '' })
  const [pwBusy, setPwBusy] = useState(false)
  const [services, setServices] = useState({})

  useEffect(() => {
    getSettingsAdmin()
      .then((rows) => {
        const out = { ...DEFAULT_SETTINGS }
        rows.forEach((r) => (out[r.setting_key] = r.setting_value))
        if (!Array.isArray(out.categories)) out.categories = DEFAULT_SETTINGS.categories
        setForm(out)
      })
      .catch((err) => setError(friendlyError(err)))
    tmdbStatus().then((tmdb) => setServices((s) => ({ ...s, tmdb })), (e) => setServices((s) => ({ ...s, tmdb: { configured: false, error: e.message } })))
    aiStatus().then((ai) => setServices((s) => ({ ...s, ai })), (e) => setServices((s) => ({ ...s, ai: { configured: false, error: e.message } })))
  }, [])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const setCat = (i, key, value) => setForm((f) => ({ ...f, categories: f.categories.map((c, n) => (n === i ? { ...c, [key]: value } : c)) }))

  async function submit(e) {
    e.preventDefault()
    const categories = form.categories.map((c) => ({ code: String(c.code || '').trim().toLowerCase(), en: String(c.en || '').trim(), si: String(c.si || '').trim() })).filter((c) => c.code)
    if (categories.some((c) => !/^[a-z]{2,3}$/.test(c.code) || !c.en)) return toast('Each category needs a 2–3 letter language code and an English name.', 'bad')
    if (new Set(categories.map((c) => c.code)).size !== categories.length) return toast('Two categories use the same language code.', 'bad')
    for (const key of ['logo_url', 'facebook_url', 'telegram_url']) if (form[key] && !/^https:\/\//.test(form[key].trim())) return toast('Links must start with https://', 'bad')
    setSaving(true)
    try {
      await saveSettings({
        site_name: form.site_name.trim() || 'SubLanka', tagline: form.tagline.trim(), description: form.description.trim(), logo_url: form.logo_url.trim(),
        contact_email: form.contact_email.trim(), facebook_url: form.facebook_url.trim(), telegram_url: form.telegram_url.trim(), categories,
      })
      await reload()
      toast('Settings saved. The public site uses them straight away.')
    } catch (err) {
      toast(friendlyError(err), 'bad')
    } finally {
      setSaving(false)
    }
  }

  async function submitPassword(e) {
    e.preventDefault()
    if (pw.a.length < 10) return toast('Use at least 10 characters.', 'bad')
    if (pw.a !== pw.b) return toast('The two passwords do not match.', 'bad')
    setPwBusy(true)
    try {
      await changePassword(pw.a)
      setPw({ a: '', b: '' })
      toast('Password changed.')
    } catch (err) {
      toast(friendlyError(err), 'bad')
    } finally {
      setPwBusy(false)
    }
  }

  return (
    <>
      <PageHead title="Settings" sub="Site identity, categories and contact details." />
      {error && <p className="notice notice-bad">{error}</p>}
      {!form && !error && <Busy />}
      {form && (
        <form className="panel" onSubmit={submit}>
          <h2>Site</h2>
          <div className="form-grid">
            <Field label="Site name" className="span-2">
              <input className="input" maxLength={60} value={form.site_name} onChange={set('site_name')} />
            </Field>
            <Field label="Tagline" className="span-2">
              <input className="input" lang="si" maxLength={120} value={form.tagline} onChange={set('tagline')} />
            </Field>
            <Field label="Description (used for search engines and sharing)" className="span-4">
              <textarea className="textarea" rows={3} lang="si" maxLength={300} value={form.description} onChange={set('description')} />
            </Field>
            <Field label="Logo image URL" hint="Optional. Leave empty to use the built-in SubLanka logo." className="span-2">
              <input className="input" type="url" placeholder="https://…" value={form.logo_url} onChange={set('logo_url')} />
            </Field>
            <Field label="Contact email" hint="Shown in the footer and on the Copyright page." className="span-2">
              <input className="input" type="email" value={form.contact_email} onChange={set('contact_email')} />
            </Field>
            <Field label="Facebook page URL" className="span-2">
              <input className="input" type="url" placeholder="https://facebook.com/…" value={form.facebook_url} onChange={set('facebook_url')} />
            </Field>
            <Field label="Telegram channel URL" className="span-2">
              <input className="input" type="url" placeholder="https://t.me/…" value={form.telegram_url} onChange={set('telegram_url')} />
            </Field>
          </div>

          <h2>Categories</h2>
          <p className="hint">Each category is a movie’s original language. Everything else appears under “Other”.</p>
          <div className="cat-rows">
            {form.categories.map((c, i) => (
              <div className="cat-row" key={i}>
                <select className="select" aria-label="Language" value={c.code} onChange={(e) => setForm((f) => ({ ...f, categories: f.categories.map((x, n) => (n === i ? { code: e.target.value, en: LANGS[e.target.value]?.en || x.en, si: LANGS[e.target.value]?.si || x.si } : x)) }))}>
                  {!LANGS[c.code] && <option value={c.code}>{c.code || 'Choose…'}</option>}
                  {Object.entries(LANGS).map(([code, l]) => (
                    <option key={code} value={code}>
                      {l.en} ({code})
                    </option>
                  ))}
                </select>
                <input className="input" aria-label="English name" placeholder="English name" value={c.en} onChange={(e) => setCat(i, 'en', e.target.value)} />
                <input className="input" aria-label="Sinhala name" placeholder="සිංහල නම" lang="si" value={c.si} onChange={(e) => setCat(i, 'si', e.target.value)} />
                <button type="button" className="icon-btn icon-danger" aria-label="Remove category" onClick={() => setForm((f) => ({ ...f, categories: f.categories.filter((_, n) => n !== i) }))}>
                  <Trash2 />
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm((f) => ({ ...f, categories: [...f.categories, { code: '', en: '', si: '' }] }))}>
            <Plus /> Add category
          </button>

          <div className="save-bar">
            <span className="spacer" />
            <button className="btn" disabled={saving}>
              {saving ? <Loader2 className="spin" /> : <Save />} Save settings
            </button>
          </div>
        </form>
      )}

      <section className="panel">
        <h2>Connected services</h2>
        <ul className="services">
          <Service name="TMDB" state={services.tmdb} hint="Movie details and posters. Secret name: TMDB_API_KEY (Supabase → Edge Functions → Secrets)." />
          <Service name="Gemini AI" state={services.ai} hint="Sinhala descriptions and subtitle translation drafts. Secret name: GEMINI_API_KEY (free tier, optional)." />
        </ul>
        <p className="hint">API keys are stored only as Supabase Edge Function secrets. They are never part of this website’s code.</p>
      </section>

      <form className="panel" onSubmit={submitPassword}>
        <h2>Change your password</h2>
        <div className="form-grid">
          <Field label="New password" className="span-2">
            <input className="input" type="password" autoComplete="new-password" minLength={10} value={pw.a} onChange={(e) => setPw((p) => ({ ...p, a: e.target.value }))} />
          </Field>
          <Field label="Repeat new password" className="span-2">
            <input className="input" type="password" autoComplete="new-password" value={pw.b} onChange={(e) => setPw((p) => ({ ...p, b: e.target.value }))} />
          </Field>
        </div>
        <div className="save-bar">
          <span className="spacer" />
          <button className="btn btn-ghost" disabled={pwBusy || !pw.a}>
            {pwBusy ? <Loader2 className="spin" /> : <KeyRound />} Change password
          </button>
        </div>
      </form>
    </>
  )
}
