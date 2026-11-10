import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, User, Calendar, Layers, BadgeCheck, CircleCheck } from 'lucide-react'
import { driveDownloadUrl } from '../lib/drive.js'
import { registerDownload } from '../services/movies.js'
import { langName, PERMISSIONS } from '../lib/constants.js'
import { formatDate, compactNumber } from '../lib/format.js'

export default function SubtitleItem({ sub }) {
  const [done, setDone] = useState(false)
  // derived, so a refreshed count from the server shows up without losing the visitor's own click
  const count = (sub.download_count || 0) + (done ? 1 : 0)
  const lang = langName(sub.language)
  const label = sub.language === 'si' ? 'සිංහල උපසිරැසි බාගන්න' : `${lang} බාගන්න`

  const onDownload = () => {
    if (!done) {
      setDone(true)
      registerDownload(sub.id)
    }
  }

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
        aria-label={`${label} — ${sub.format.toUpperCase()}${sub.version ? ', ' + sub.version : ''}`}
      >
        <Download aria-hidden="true" /> {label}
      </a>
      <p className="sub-status" role="status">
        {done && (
          <>
            <CircleCheck aria-hidden="true" />
            <span>බාගත කිරීම නව ටැබ් එකක (Google Drive) ආරම්භ විය. ආරම්භ නොවුණේ නම් බොත්තම නැවත ඔබන්න; එසේත් නොහැකි නම් <Link to="/copyright/#contact">අපට දන්වන්න</Link>.</span>
          </>
        )}
      </p>
    </li>
  )
}
