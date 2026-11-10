import { useState } from 'react'
import { Play, Clapperboard } from 'lucide-react'
import { youtubeEmbedUrl, youtubeThumb } from '../lib/youtube.js'

/**
 * Official YouTube embed, loaded only after the visitor presses play
 * (fast page load, and nothing is requested from the player until then).
 */
export default function TrailerPlayer({ videoId, title }) {
  const [playing, setPlaying] = useState(false)
  const [thumbFailed, setThumbFailed] = useState(false)

  if (!videoId) {
    return (
      <div className="trailer-empty">
        <Clapperboard />
        <div>
          <strong>තහවුරු කළ ට්‍රේලරයක් තවම නොමැත</strong>
          <p>මෙම චිත්‍රපටය සඳහා නිල ට්‍රේලරයක් තහවුරු කළ පසු එය මෙහි දිස්වනු ඇත.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="trailer">
      {playing ? (
        <iframe
          src={youtubeEmbedUrl(videoId)}
          title={`${title} — ට්‍රේලරය`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      ) : (
        // The accessible label starts with the visible text so voice control works.
        <button className="trailer-poster" onClick={() => setPlaying(true)} aria-label={`ට්‍රේලරය නරඹන්න • YouTube — ${title}`}>
          {!thumbFailed && <img src={youtubeThumb(videoId)} alt="" loading="lazy" decoding="async" width="480" height="360" onError={() => setThumbFailed(true)} />}
          <span className="trailer-play">
            <Play />
          </span>
          <span className="trailer-label">ට්‍රේලරය නරඹන්න • YouTube</span>
        </button>
      )}
    </div>
  )
}
