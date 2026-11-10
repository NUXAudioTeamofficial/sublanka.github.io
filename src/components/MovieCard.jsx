import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Star, Film, Captions, Download } from 'lucide-react'
import { moviePath, posterSrcSet, tmdbSize, compactNumber } from '../lib/format.js'
import { langName, genreName } from '../lib/constants.js'

export function Poster({ src, title, sizes = '(max-width: 600px) 45vw, 200px', eager = false }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div className="poster-fallback" role="img" aria-label={`${title} — පෝස්ටරයක් නොමැත`}>
        <Film />
        <span>{title}</span>
      </div>
    )
  }
  return (
    <img
      src={tmdbSize(src, 'w342')}
      srcSet={posterSrcSet(src)}
      sizes={sizes}
      alt={`${title} පෝස්ටරය`}
      width="342"
      height="513"
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
    />
  )
}

export default function MovieCard({ movie, rank, showDownloads = false }) {
  const hasSinhala = movie.subtitle_languages?.includes('si')
  return (
    <Link to={moviePath(movie)} className={`card${rank ? ' card-ranked' : ''}`} aria-label={`${movie.title}${movie.release_year ? ` (${movie.release_year})` : ''}`}>
      {rank && <span className="card-rank" aria-hidden="true">{rank}</span>}
      <div className="card-poster">
        <Poster src={movie.poster_url} title={movie.title} />
        <div className="card-badges">
          {movie.rating > 0 && (
            <span className="pill pill-rating">
              <Star /> {Number(movie.rating).toFixed(1)}
            </span>
          )}
          <span className="pill">{langName(movie.language)}</span>
        </div>
        {movie.subtitle_count > 0 && (
          <span className="card-sub">
            <Captions /> {hasSinhala ? 'සිංහල' : 'SUB'}
            {movie.subtitle_count > 1 && <b>×{movie.subtitle_count}</b>}
          </span>
        )}
        <span className="card-cta" aria-hidden="true">
          <Download />
        </span>
      </div>
      <div className="card-body">
        <h3 className="card-title">{movie.title}</h3>
        <p className="card-meta">
          {movie.release_year && <span>{movie.release_year}</span>}
          {showDownloads && movie.total_downloads > 0 ? (
            <span><Download /> {compactNumber(movie.total_downloads)}</span>
          ) : (
            movie.genres?.[0] && <span>{genreName(movie.genres[0])}</span>
          )}
        </p>
      </div>
    </Link>
  )
}

export function CardSkeleton() {
  return (
    <div className="card" aria-hidden="true">
      <div className="card-poster skeleton" />
      <div className="card-body">
        <div className="skeleton" style={{ height: 14, width: '80%', borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 10, width: '45%', borderRadius: 6, marginTop: 8 }} />
      </div>
    </div>
  )
}
