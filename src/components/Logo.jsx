import { useSettings } from '../context/SettingsContext.jsx'

/**
 * SubLanka mark: a rising half-disc inside a ring (the island sunrise / moonstone)
 * resting on two caption lines — "the world of subtitles".
 */
export function LogoMark({ size = 36 }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <rect x="0.75" y="0.75" width="46.5" height="46.5" rx="11.25" fill="#121620" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" />
      <path d="M10.5 25a13.5 13.5 0 0 1 27 0" fill="none" stroke="#42d6c5" strokeWidth="3" strokeLinecap="round" />
      <path d="M17.2 25a6.8 6.8 0 0 1 13.6 0Z" fill="#e9b86a" />
      <rect x="10" y="29.6" width="28" height="3.2" rx="1.6" fill="#f5f3ee" />
      <rect x="15.5" y="35.6" width="17" height="3.2" rx="1.6" fill="#f5f3ee" opacity="0.5" />
    </svg>
  )
}

export default function Logo({ size = 36, showText = true, tagline = false }) {
  const { settings } = useSettings()
  const name = settings.site_name || 'SubLanka'
  const split = name === 'SubLanka' ? ['Sub', 'Lanka'] : [name, '']
  return (
    <span className="logo">
      {settings.logo_url ? <img className="logo-img" src={settings.logo_url} alt="" width={size} height={size} /> : <LogoMark size={size} />}
      {showText && (
        <span className="logo-words">
          <span className="logo-text">
            {split[0]}
            {split[1] && <em>{split[1]}</em>}
          </span>
          {tagline && settings.tagline && <span className="logo-tag">{settings.tagline}</span>}
        </span>
      )}
    </span>
  )
}
