const ID_RE = /^[A-Za-z0-9_-]{11}$/

/** Accepts a YouTube URL (watch, youtu.be, embed, shorts) or a bare 11-char id. Returns the id or null. */
export function parseYouTubeId(input) {
  const raw = String(input || '').trim()
  if (!raw) return null
  if (ID_RE.test(raw)) return raw
  let url
  try {
    url = new URL(raw.startsWith('http') ? raw : 'https://' + raw)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^www\.|^m\./, '')
  let id = null
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0]
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'music.youtube.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v')
    else {
      const m = url.pathname.match(/^\/(?:embed|shorts|v|live)\/([^/?#]+)/)
      if (m) id = m[1]
    }
  }
  return id && ID_RE.test(id) ? id : null
}

export const youtubeThumb = (id, quality = 'hqdefault') => `https://i.ytimg.com/vi/${id}/${quality}.jpg`
// Privacy-enhanced official embed. Nothing is loaded from YouTube until the visitor presses play.
export const youtubeEmbedUrl = (id) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`
export const youtubeWatchUrl = (id) => `https://www.youtube.com/watch?v=${id}`
