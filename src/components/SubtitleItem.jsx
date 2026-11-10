import { useState } from 'react'
import { Download, User, Calendar, Layers, BadgeCheck } from 'lucide-react'
import { driveDownloadUrl } from '../lib/drive.js'
import { registerDownload } from '../services/movies.js'
import { langName, PERMISSIONS } from '../lib/constants.js'
import { formatDate, compactNumber } from '../lib/format.js'

export default function SubtitleItem({ sub }) {
  const [count, setCount] = useState(sub.download_count || 0)
  const [done, setDone] = useState(false)
  const lang = langName(sub.language)

  const onDownload = () => {
    if (!done) {
      setDone(true)
      setCount((c) => c + 1)
      registerDownload(sub.id)
    }
  }

  // The visible button text must be part of the accessible name (voice control).
  const cta = sub.language === 'si' ? 'සිංහල උපසිරැසි බාගන්න' : `${lang} බාගන්න`

  return (
    <li className="sub">
      <div className="sub-lang" aria-hidden="true">{sub.language.toUpperCase()}</div>
      <div className="sub-main">
        <h3>
          {lang} උපසිරැසි
          <span className="badge badge-accent">{sub.format.toUpperCase()}</span>
          {sub.version && <span className="badge">{sub.version}</span>}
        </h3>
        <p className="sub-meta">
          {sub.translator && <span><User /> {sub.translator}</span>}
          <span><Calendar /> {formatDate(sub.created_at)}</span>
          <span><Download /> {compactNumber(count)}</span>
          <span title={PERMISSIONS[sub.permission_status]?.hint}><BadgeCheck /> {PERMISSIONS[sub.permission_status]?.label}</span>
        </p>
        {sub.description && <p className="sub-desc">{sub.description}</p>}
        {sub.permission_note && <p className="sub-note"><Layers /> {sub.permission_note}</p>}
      </div>
      <a
        className="btn sub-btn"
        href={driveDownloadUrl(sub.drive_file_id)}
        target="_blank"
        rel="noopener noreferrer nofollow"
        onClick={onDownload}
        aria-label={`${cta} — ${sub.format.toUpperCase()}${sub.version ? ', ' + sub.version : ''}`}
      >
        <Download /> {cta}
      </a>
    </li>
  )
}
