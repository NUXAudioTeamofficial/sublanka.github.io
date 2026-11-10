import { Link } from 'react-router-dom'
import { Mail, Send, Facebook, ShieldCheck } from 'lucide-react'
import Logo from './Logo.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { asset } from '../lib/config.js'

export default function Footer() {
  const { settings } = useSettings()
  const cats = [...settings.categories, { code: 'other', en: 'Other', si: 'වෙනත්' }]
  const year = new Date().getFullYear()
  return (
    <footer className="footer">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <Logo size={40} tagline />
          <p>{settings.description}</p>
          <p className="footer-safe">
            <ShieldCheck /> උපසිරැසි පමණි — චිත්‍රපට වීඩියෝ ගොනු මෙහි නොමැත.
          </p>
        </div>

        <nav aria-label="භාෂා කාණ්ඩ">
          <h3>චිත්‍රපට</h3>
          <ul>
            <li><Link to="/browse/?sort=recent">සියලුම චිත්‍රපට <small>Browse</small></Link></li>
            <li><Link to="/browse/">අලුත්ම උපසිරැසි <small>Latest</small></Link></li>
            {cats.map((c) => (
              <li key={c.code}>
                <Link to={`/browse/?lang=${c.code}`}>
                  {c.si} <small>{c.en}</small>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="තොරතුරු">
          <h3>තොරතුරු</h3>
          <ul>
            <li><Link to="/about/">අප ගැන <small>About</small></Link></li>
            <li><Link to="/copyright/">ප්‍රකාශන හිමිකම් <small>Copyright &amp; takedown</small></Link></li>
            <li><Link to="/privacy/">රහස්‍යතා ප්‍රතිපත්තිය <small>Privacy</small></Link></li>
            <li><Link to="/terms/">භාවිත කොන්දේසි <small>Terms</small></Link></li>
          </ul>
        </nav>

        <div>
          <h3>අප අමතන්න</h3>
          <ul className="footer-contact">
            {settings.contact_email && (
              <li>
                <a href={`mailto:${settings.contact_email}`}><Mail /> {settings.contact_email}</a>
              </li>
            )}
            {settings.telegram_url && (
              <li>
                <a href={settings.telegram_url} target="_blank" rel="noopener noreferrer"><Send /> Telegram</a>
              </li>
            )}
            {settings.facebook_url && (
              <li>
                <a href={settings.facebook_url} target="_blank" rel="noopener noreferrer"><Facebook /> Facebook</a>
              </li>
            )}
            <li>
              <Link to="/copyright/#contact"><Mail /> පණිවිඩයක් යවන්න</Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="wrap footer-bottom">
        <p>
          © {year} {settings.site_name}. චිත්‍රපට නාම, පෝස්ටර් සහ ට්‍රේලර්වල සියලු හිමිකම් ඒවායේ නියම අයිතිකරුවන් සතුය.
        </p>
        <Link className="footer-admin" to="/admin/" rel="nofollow">Admin</Link>
        <a className="tmdb" href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">
          <img src={asset('tmdb.svg')} alt="TMDB" width="92" height="12" loading="lazy" />
          <span>This product uses the TMDB API but is not endorsed or certified by TMDB.</span>
        </a>
      </div>
    </footer>
  )
}
