import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, Scale, Lock, Info, Send, CircleCheck, LoaderCircle, Mail, Captions, Play, Search, Film } from 'lucide-react'
import { useSettings } from '../context/SettingsContext.jsx'
import { useSeo } from '../lib/seo.js'
import { submitRequest } from '../services/settings.js'
import { Empty } from '../components/States.jsx'

function Prose({ icon: Icon, kicker, title, updated, children }) {
  return (
    <div className="wrap page prose-page">
      <header className="page-head">
        <p className="kicker"><Icon /> {kicker}</p>
        <h1>{title}</h1>
        {updated && <p className="dim">අවසන් යාවත්කාලීන කිරීම / Last updated: {updated}</p>}
      </header>
      <div className="prose">{children}</div>
    </div>
  )
}

const UPDATED = '10 November 2026'

export function About() {
  const { settings } = useSettings()
  useSeo({ title: 'අප ගැන — About', description: `${settings.site_name} යනු සිංහල උපසිරැසි සොයා බාගත හැකි නාමාවලියකි. A catalogue of Sinhala subtitles — subtitles only, no movie files.`, path: 'about/', siteName: settings.site_name })
  return (
    <Prose icon={Info} kicker="About" title={`${settings.site_name} ගැන`}>
      <p className="lead">
        {settings.site_name} — <strong>{settings.tagline}</strong>. ලොව පුරා චිත්‍රපට සිංහලෙන් රසවිඳීමට කැමති අයට උපසිරැසි පහසුවෙන් සොයාගැනීමට, ට්‍රේලරය නැරඹීමට සහ බාගැනීමට හදපු තැනක්.
      </p>
      <div className="about-cards">
        <div><Search /><h3>සොයන්න</h3><p>නම, වසර, භාෂාව හෝ ප්‍රභේදය අනුව චිත්‍රපට සොයන්න.</p></div>
        <div><Play /><h3>ට්‍රේලර්</h3><p>නිල YouTube ට්‍රේලරය පිටුවේම නරඹන්න.</p></div>
        <div><Captions /><h3>උපසිරැසි</h3><p>ඔබේ පිටපතට ගැළපෙන සිංහල උපසිරැසිය බාගන්න.</p></div>
      </div>
      <h2>අපි කරන දේ සහ නොකරන දේ</h2>
      <ul>
        <li>මෙය <strong>උපසිරැසි නාමාවලියක් පමණි</strong>. චිත්‍රපට වීඩියෝ ගොනු මෙහි ගබඩා කිරීම, බෙදාහැරීම හෝ streaming කිරීම සිදු නොකෙරේ.</li>
        <li>ප්‍රකාශයට පත් කරන්නේ අප විසින්ම සකස් කළ, හෝ බෙදාහැරීමට අවසර ලැබුණු උපසිරැසි පමණි.</li>
        <li>චිත්‍රපට තොරතුරු සහ පෝස්ටර් <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">TMDB</a> වෙතින් ලබාගනී. ට්‍රේලර් YouTube හි නිල embed player එක හරහා පෙන්වයි.</li>
        <li>සිංහල විස්තර ලියන්නේ තහවුරු කළ චිත්‍රපට තොරතුරු මත පදනම්ව ය; පරිපාලක විසින් සමාලෝචනය කිරීමෙන් පසුව පමණක් ප්‍රකාශයට පත් වේ.</li>
      </ul>
      <h2>In English</h2>
      <p>
        {settings.site_name} is a catalogue of Sinhala subtitle files. We do not host, stream or link to movie video files. Subtitles are published only when we created them or have
        permission to distribute them. Movie metadata and artwork come from TMDB; trailers are shown through the official YouTube embedded player. Movie titles, artwork and trailers belong to
        their respective owners.
      </p>
      <p>
        ගැටලුවක්, නිවැරදි කිරීමක් හෝ ප්‍රකාශන හිමිකම් ඉල්ලීමක් තිබේද? <Link to="/copyright/#contact">අප අමතන්න</Link>.
      </p>
    </Prose>
  )
}

export function Privacy() {
  const { settings } = useSettings()
  useSeo({ title: 'රහස්‍යතා ප්‍රතිපත්තිය — Privacy Policy', description: `${settings.site_name} රහස්‍යතා ප්‍රතිපත්තිය: අප රැස් කරන දත්ත, තෙවන පාර්ශ්ව සේවා සහ ඔබේ අයිතිවාසිකම්.`, path: 'privacy/', siteName: settings.site_name })
  return (
    <Prose icon={Lock} kicker="Privacy Policy" title="රහස්‍යතා ප්‍රතිපත්තිය" updated={UPDATED}>
      <p className="lead">කෙටියෙන්: මෙම වෙබ් අඩවිය භාවිතයට ගිණුමක් අවශ්‍ය නැත, දැන්වීම් ලුහුබැඳීම් (ad trackers) හෝ analytics මෙවලම් භාවිත නොකෙරේ.</p>

      <h2>1. අප රැස් කරන දත්ත — What we collect</h2>
      <ul>
        <li><strong>Download counter.</strong> When you press a download button we increase an anonymous counter for that subtitle. No IP address, account or device identifier is stored with it.</li>
        <li><strong>Contact / takedown form.</strong> If you send us a message we store the name, e-mail address, page link and message you typed, so that we can answer. Only site administrators can read it.</li>
        <li><strong>Browser storage.</strong> The site keeps a small cache of public site settings in your browser’s session storage to load faster. Administrators additionally get a sign-in session token. No advertising or tracking cookies are set by us.</li>
      </ul>

      <h2>2. තෙවන පාර්ශ්ව සේවා — Third-party services</h2>
      <p>The site relies on these providers. When your browser talks to them they receive technical data such as your IP address and browser type, under their own privacy policies:</p>
      <ul>
        <li><strong>GitHub Pages</strong> — hosts the website files.</li>
        <li><strong>Supabase</strong> — hosts the catalogue database the pages read from.</li>
        <li><strong>TMDB (image.tmdb.org)</strong> — serves movie posters and backdrops.</li>
        <li><strong>YouTube (Google)</strong> — trailer thumbnails load from YouTube’s image servers; the video player itself loads only after you press play, using YouTube’s privacy-enhanced “nocookie” mode.</li>
        <li><strong>Google Drive</strong> — subtitle files are downloaded from Google Drive when you press a download button.</li>
      </ul>

      <h2>3. දත්ත භාවිතය — How we use data</h2>
      <p>Only to run the catalogue: to show which subtitles are popular and to reply to messages. We do not sell or share personal data, and we do not build visitor profiles.</p>

      <h2>4. රඳවා තබාගැනීම — Retention</h2>
      <p>Contact messages are kept while the matter is open and deleted when they are no longer needed. Download counters contain no personal data.</p>

      <h2>5. ඔබේ අයිතිවාසිකම් — Your rights</h2>
      <p>You may ask us to show, correct or delete a message you sent us. Use the <Link to="/copyright/#contact">contact form</Link>{settings.contact_email ? <> or e-mail <a href={`mailto:${settings.contact_email}`}>{settings.contact_email}</a></> : null}.</p>

      <h2>6. වෙනස්කම් — Changes</h2>
      <p>If this policy changes, the new version will be published on this page with a new date.</p>
    </Prose>
  )
}

export function Terms() {
  const { settings } = useSettings()
  useSeo({ title: 'භාවිත කොන්දේසි — Terms of Use', description: `${settings.site_name} භාවිත කොන්දේසි. Subtitles only; movie rights belong to their respective owners.`, path: 'terms/', siteName: settings.site_name })
  return (
    <Prose icon={Scale} kicker="Terms of Use" title="භාවිත කොන්දේසි" updated={UPDATED}>
      <p className="lead">මෙම වෙබ් අඩවිය භාවිත කිරීමෙන් ඔබ පහත කොන්දේසිවලට එකඟ වේ.</p>

      <h2>1. සේවාව — The service</h2>
      <p>{settings.site_name} is a catalogue of subtitle files with movie information and official trailers. <strong>It is not a streaming or movie download site.</strong> No movie video files are hosted, embedded or linked here.</p>

      <h2>2. උපසිරැසි භාවිතය — Using subtitles</h2>
      <ul>
        <li>Subtitles are provided for personal, non-commercial use together with a copy of the film that you obtained lawfully.</li>
        <li>Do not re-upload, sell or pass off the subtitles as your own work. Credit the translator where a name is shown.</li>
        <li>Subtitle timing depends on the video release; pick the version that matches yours.</li>
      </ul>

      <h2>3. හිමිකම් — Ownership</h2>
      <p>All movie titles, posters, images and trailers are the property of their respective owners and are shown for identification only. Movie data and images are provided by TMDB; this product uses the TMDB API but is not endorsed or certified by TMDB. Trailers are played through YouTube’s official embedded player and remain subject to YouTube’s terms.</p>

      <h2>4. පිළිගත හැකි භාවිතය — Acceptable use</h2>
      <p>Do not attempt to break, overload or gain unauthorised access to the site, its database or its administration area, and do not submit false copyright claims.</p>

      <h2>5. වගකීම් සීමාව — No warranty</h2>
      <p>The site and the subtitle files are provided “as is”, without any guarantee of accuracy, availability or fitness for a particular purpose. Downloads are served by Google Drive, which may limit or remove files.</p>

      <h2>6. ප්‍රකාශන හිමිකම් ගැටලු — Copyright concerns</h2>
      <p>If you believe something here infringes your rights, follow the <Link to="/copyright/">copyright &amp; takedown process</Link>. Disputed files are unpublished while we look into the matter.</p>

      <h2>7. වෙනස්කම් — Changes</h2>
      <p>We may update these terms; the current version is always on this page.</p>
    </Prose>
  )
}

function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', kind: 'copyright', page_url: '', message: '', website: '' })
  const [state, setState] = useState({ status: 'idle' })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (form.website) return setState({ status: 'sent' }) // honeypot: bots fill hidden fields
    if (form.message.trim().length < 10) return setState({ status: 'error', message: 'කරුණාකර අවම වශයෙන් අකුරු 10ක පණිවිඩයක් ලියන්න.' })
    setState({ status: 'sending' })
    try {
      await submitRequest(form)
      setState({ status: 'sent' })
    } catch (err) {
      setState({ status: 'error', message: err.status === 400 || err.code === '23514' ? 'කරුණාකර ඇතුළත් කළ තොරතුරු පරීක්ෂා කරන්න (නම, වලංගු e-mail, පණිවිඩය).' : err.message })
    }
  }

  if (state.status === 'sent') {
    return (
      <div className="notice notice-ok" role="status">
        <CircleCheck />
        <div><strong>ඔබේ පණිවිඩය ලැබුණා. ස්තූතියි!</strong><br />අපි එය සමාලෝචනය කර ඔබ ලබාදුන් e-mail ලිපිනයට පිළිතුරු දෙන්නෙමු.</div>
      </div>
    )
  }

  return (
    <form className="contact-form" onSubmit={submit} noValidate={false}>
      <div className="form-2">
        <div className="field">
          <label htmlFor="cf-name">නම / Name</label>
          <input id="cf-name" className="input" required minLength={2} maxLength={120} value={form.name} onChange={set('name')} autoComplete="name" />
        </div>
        <div className="field">
          <label htmlFor="cf-email">E-mail</label>
          <input id="cf-email" className="input" type="email" required maxLength={200} value={form.email} onChange={set('email')} autoComplete="email" />
        </div>
      </div>
      <div className="form-2">
        <div className="field">
          <label htmlFor="cf-kind">වර්ගය / Type</label>
          <select id="cf-kind" className="select" value={form.kind} onChange={set('kind')}>
            <option value="copyright">ප්‍රකාශන හිමිකම් / ඉවත් කිරීමේ ඉල්ලීම (Copyright / takedown)</option>
            <option value="correction">වැරදි තොරතුරක් / කැඩුණු link එකක් (Correction)</option>
            <option value="general">වෙනත් (General)</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="cf-url">අදාළ පිටුවේ link එක (තිබේ නම්)</label>
          <input id="cf-url" className="input" type="url" maxLength={500} placeholder="https://…" value={form.page_url} onChange={set('page_url')} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="cf-msg">පණිවිඩය / Message</label>
        <textarea id="cf-msg" className="textarea" required minLength={10} maxLength={4000} rows={6} value={form.message} onChange={set('message')} />
        <span className="hint">ප්‍රකාශන හිමිකම් ඉල්ලීමක් නම්: අදාළ කෘතිය, ඔබ එහි අයිතිකරු හෝ නියෝජිතයා බව, සහ ඉවත් කළ යුතු දේ පැහැදිලිව සඳහන් කරන්න.</span>
      </div>
      <input className="hp" type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} aria-hidden="true" />
      {state.status === 'error' && <div className="notice notice-bad" role="alert"><Info /> {state.message}</div>}
      <button className="btn" type="submit" disabled={state.status === 'sending'}>
        {state.status === 'sending' ? <LoaderCircle className="spin" /> : <Send />} යවන්න
      </button>
    </form>
  )
}

export function Copyright() {
  const { settings } = useSettings()
  useSeo({ title: 'ප්‍රකාශන හිමිකම් සහ සම්බන්ධ වීම — Copyright & Contact', description: `${settings.site_name} ප්‍රකාශන හිමිකම් ප්‍රතිපත්තිය, ඉවත් කිරීමේ (takedown) ක්‍රියාවලිය සහ සම්බන්ධ වීමේ තොරතුරු.`, path: 'copyright/', siteName: settings.site_name })
  return (
    <Prose icon={ShieldCheck} kicker="Copyright & Contact" title="ප්‍රකාශන හිමිකම් සහ අප අමතන්න" updated={UPDATED}>
      <p className="lead">චිත්‍රපටවල සියලු හිමිකම් ඒවායේ නියම අයිතිකරුවන් සතුය. {settings.site_name} හි ඇත්තේ උපසිරැසි ගොනු පමණි.</p>

      <h2>අපගේ ප්‍රතිපත්තිය — Our policy</h2>
      <ul>
        <li>We do <strong>not</strong> host, stream, embed or link to movie video files.</li>
        <li>We publish a subtitle only when it is our own work, or when we hold permission or a licence to distribute it. Every published file carries a rights status.</li>
        <li>Posters and movie details are displayed through the TMDB API under its terms. Trailers are official YouTube embeds; we never download or re-host them.</li>
        <li>Movie names, artwork and trailers are used solely to identify the film a subtitle belongs to.</li>
      </ul>

      <h2>ඉවත් කිරීමේ ක්‍රියාවලිය — Takedown process</h2>
      <ol>
        <li><strong>Tell us.</strong> Use the form below (choose “Copyright / takedown”){settings.contact_email ? <> or e-mail <a href={`mailto:${settings.contact_email}`}>{settings.contact_email}</a></> : null}.</li>
        <li><strong>Include:</strong> the work concerned, the exact page link on this site, a statement that you are the rights holder or authorised to act for them, and your contact details.</li>
        <li><strong>We act.</strong> The file in question is unpublished while the request is reviewed, so it can no longer be found or downloaded through this site.</li>
        <li><strong>We reply</strong> to the e-mail address you gave with the outcome. Valid requests result in permanent removal.</li>
      </ol>
      <p>ඔබ උපසිරැසියක පරිවර්තකයා නම් සහ එය ඔබේ අවසරයකින් තොරව මෙහි ඇතැයි සිතන්නේ නම්, එයද මෙම ක්‍රියාවලිය හරහාම දැනුම් දෙන්න.</p>

      <h2 id="contact">අප අමතන්න — Contact</h2>
      {settings.contact_email && (
        <p><Mail className="inline-icon" /> <a href={`mailto:${settings.contact_email}`}>{settings.contact_email}</a></p>
      )}
      <ContactForm />
    </Prose>
  )
}

export function NotFound() {
  const { settings } = useSettings()
  useSeo({ title: 'පිටුව හමු නොවීය — 404', description: '', noindex: true, siteName: settings.site_name })
  return (
    <div className="wrap page">
      <Empty icon={Film} title="404 — පිටුව හමු නොවීය" action={<Link className="btn btn-sm" to="/">මුල් පිටුවට යන්න</Link>}>
        ඔබ සොයන පිටුව ඉවත් කර හෝ ලිපිනය වෙනස් කර තිබිය හැක.
      </Empty>
    </div>
  )
}
