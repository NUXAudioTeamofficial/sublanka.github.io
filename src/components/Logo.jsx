import { useSettings } from '../context/SettingsContext.jsx'

export function LogoMark({ size = 36 }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="lm-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c3aed" />
          <stop offset="0.55" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#c084fc" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill="url(#lm-g)" />
      <path d="M19.5 11.6v13.8a1.2 1.2 0 0 0 1.83 1.02l11.2-6.9a1.2 1.2 0 0 0 0-2.04l-11.2-6.9a1.2 1.2 0 0 0-1.83 1.02Z" fill="#fff" />
      <rect x="9" y="31" width="30" height="3.6" rx="1.8" fill="#fff" />
      <rect x="14" y="37.2" width="20" height="3.6" rx="1.8" fill="#fff" opacity="0.7" />
    </svg>
  )
}

export default function Logo({ size = 36, showText = true }) {
  const { settings } = useSettings()
  const name = settings.site_name || 'SubLanka'
  const split = name === 'SubLanka' ? ['Sub', 'Lanka'] : [name, '']
  return (
    <span className="logo">
      {settings.logo_url ? <img className="logo-img" src={settings.logo_url} alt="" width={size} height={size} /> : <LogoMark size={size} />}
      {showText && (
        <span className="logo-text">
          {split[0]}
          {split[1] && <em>{split[1]}</em>}
        </span>
      )}
    </span>
  )
}
