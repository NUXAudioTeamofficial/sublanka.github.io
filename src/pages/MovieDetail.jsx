import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Star, Calendar, Clock, Languages, Download, Play, ArrowLeft, Captions, Film, Info, ExternalLink } from 'lucide-react'
import { getMovie, getSubtitles, searchMovies } from '../services/movies.js'
import { useSettings } from '../context/SettingsContext.jsx'
import { useSeo, absoluteUrl } from '../lib/seo.js'
import { moviePath, tmdbSize, backdropSrcSet, runtimeLabel } from '../lib/format.js'
import { langName, genreName } from '../lib/constants.js'
import MovieCard, { Poster } from '../components/MovieCard.jsx'
import TrailerPlayer from '../components/TrailerPlayer.jsx'
import SubtitleItem from '../components/SubtitleItem.jsx'
import Rail, { SectionHead } from '../components/Rail.jsx'
import { Empty, ErrorState } from '../components/States.jsx'

export default function MovieDetail() {
  const { slug } = useParams()
  const id = parseInt(slug, 10)
  const { settings } = useSettings()
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    let alive = true
    setState({ status: 'loading' })
    if (!Number.isFinite(id)) {
      setState({ status: 'missing' })
      return
    }
    ;(async () => {
      try {
        const [movie, subtitles] = await Promise.all([getMovie(id), getSubtitles(id)])
        if (!alive) return
        if (!movie) return setState({ status: 'missing' })
        setState({ status: 'done', movie, subtitles, related: [] })
        const related = await searchMovies({ lang: movie.language, sort: 'latest', pageSize: 9, categories: [] }).catch(() => [])
        if (alive) setState((s) => (s.status === 'done' ? { ...s, related: related.filter((m) => m.id !== movie.id).slice(0, 8) } : s))
      } catch (error) {
        if (alive) setState({ status: 'error', error })
      }
    })()
    return () => {
      alive = false
    }
  }, [id])

  const movie = state.movie
  const year = movie?.release_year
  const description = movie?.sinhala_description?.trim()

  useSeo(
    movie
      ? {
          title: `${movie.title}${year ? ` (${year})` : ''} සිංහල උපසිරැසි | Sinhala Subtitles`,
          description: (description || `${movie.title}${year ? ` (${year})` : ''} චිත්‍රපටය සඳහා සිංහල උපසිරැසි බාගන්න.`).slice(0, 300),
          path: moviePath(movie).slice(1),
          image: movie.backdrop_url ? tmdbSize(movie.backdrop_url, 'w1280') : movie.poster_url || undefined,
          type: 'video.movie',
          siteName: settings.site_name,
          jsonLd: {
            '@context': 'https://schema.org',
            '@type': 'Movie',
            name: movie.title,
            ...(movie.original_title && movie.original_title !== movie.title ? { alternateName: movie.original_title } : {}),
            ...(year ? { datePublished: String(year) } : {}),
            ...(movie.poster_url ? { image: movie.poster_url } : {}),
            ...(movie.genres?.length ? { genre: movie.genres } : {}),
            ...(description ? { description } : {}),
            inLanguage: movie.language,
            url: absoluteUrl(moviePath(movie).slice(1)),
          },
        }
      : { title: state.status === 'missing' ? 'චිත්‍රපටය හමු නොවීය' : 'චිත්‍රපටය', description: '', noindex: state.status !== 'loading', siteName: settings.site_name },
  )

  if (state.status === 'loading') {
    return (
      <div className="wrap page detail-skeleton" aria-busy="true">
        <div className="skeleton" style={{ aspectRatio: '2/3', width: 'min(260px, 60vw)' }} />
        <div style={{ flex: 1, minWidth: 240, display: 'grid', gap: 14, alignContent: 'start' }}>
          <div className="skeleton" style={{ height: 40, width: '70%' }} />
          <div className="skeleton" style={{ height: 18, width: '40%' }} />
          <div className="skeleton" style={{ height: 120 }} />
        </div>
      </div>
    )
  }
  if (state.status === 'error') return <div className="wrap page"><ErrorState error={state.error} onRetry={() => window.location.reload()} /></div>
  if (state.status === 'missing') {
    return (
      <div className="wrap page">
        <Empty icon={Film} title="චිත්‍රපටය හමු නොවීය" action={<Link className="btn btn-sm" to="/browse/">සියලුම චිත්‍රපට බලන්න</Link>}>
          මෙම පිටුව ඉවත් කර තිබීමට හෝ තවම ප්‍රකාශයට පත් කර නොතිබීමට පුළුවන.
        </Empty>
      </div>
    )
  }

  const { subtitles, related } = state
  const sinhala = subtitles.find((s) => s.language === 'si')

  return (
    <article className="detail">
      <div className="detail-backdrop" aria-hidden="true">
        {movie.backdrop_url && (
          <img
            src={tmdbSize(movie.backdrop_url, 'w1280')}
            srcSet={backdropSrcSet(movie.backdrop_url)}
            sizes="100vw"
            alt=""
            fetchpriority="high"
            decoding="async"
          />
        )}
      </div>

      <div className="wrap detail-top">
        <Link to="/browse/" className="back-link"><ArrowLeft /> සියලුම චිත්‍රපට</Link>
        <div className="detail-grid">
          <div className="detail-poster">
            <Poster src={movie.poster_url} title={movie.title} eager sizes="(max-width: 700px) 60vw, 300px" />
          </div>

          <div className="detail-head">
            <p className="kicker">{subtitles.length > 0 ? (sinhala ? 'Sinhala subtitles' : 'Subtitles') : 'Movie'}</p>
            <h1>{movie.title} {year && <span className="detail-year">({year})</span>}</h1>
            {movie.original_title && movie.original_title !== movie.title && <p className="detail-original">මුල් නම: <span lang={movie.language}>{movie.original_title}</span></p>}
          </div>

          <div className="detail-rest">
            <ul className="facts">
              {movie.rating > 0 && (
                <li className="fact-rating" title="TMDB user rating">
                  <Star /> <b>{Number(movie.rating).toFixed(1)}</b><small>/10 TMDB</small>
                </li>
              )}
              {year && <li><Calendar /> {year}</li>}
              {movie.runtime > 0 && <li><Clock /> {runtimeLabel(movie.runtime)}</li>}
              <li><Languages /> {langName(movie.language)} <small>({langName(movie.language, 'en')})</small></li>
              <li className={subtitles.length > 0 ? 'fact-subs' : 'fact-nosubs'}>
                <Captions /> {subtitles.length > 0 ? `උපසිරැසි ${subtitles.length}` : 'උපසිරැසි තවම නැත'}
              </li>
            </ul>

            {movie.genres?.length > 0 && (
              <ul className="genres" aria-label="ප්‍රභේද">
                {movie.genres.map((g) => (
                  <li key={g}><Link className="chip" to={`/browse/?genre=${encodeURIComponent(g)}`}>{genreName(g)}</Link></li>
                ))}
              </ul>
            )}

            <div className="detail-desc">
              <h2>කතා සාරාංශය</h2>
              {description ? <p>{description}</p> : <p className="muted">මෙම චිත්‍රපටය සඳහා සිංහල විස්තරයක් තවම එක් කර නැත.</p>}
            </div>

            <div className="detail-cta">
              {subtitles.length > 0 ? (
                <a className="btn btn-lg" href="#subtitles"><Download /> {sinhala ? 'සිංහල උපසිරැසි බාගන්න' : 'උපසිරැසි බාගන්න'}</a>
              ) : (
                <span className="btn btn-lg" aria-disabled="true"><Captions /> උපසිරැසි ළඟදීම</span>
              )}
              {movie.youtube_video_id && <a className="btn btn-ghost btn-lg" href="#trailer"><Play /> ට්‍රේලරය</a>}
              {movie.watch_url && (
                <a
                  className="btn btn-ghost btn-lg"
                  href={movie.watch_url}
                  target="_blank"
                  rel="noopener noreferrer nofollow external"
                >
                  <ExternalLink /> නීත්‍යානුකූලව නරඹන්න
                </a>
              )}
            </div>
            {movie.watch_url && (
              <p className="watch-note">
                <Info size={14} aria-hidden="true" /> SubLanka තුළ චිත්‍රපට ගබඩා කර හෝ බෙදා හරිනු නොලැබේ. මෙම සබැඳිය චිත්‍රපටය නීත්‍යානුකූලව පළ කර ඇති ස්ථානයට යොමු වේ — එහිදී මෙම උපසිරැසිය භාවිතා කළ හැක.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="wrap detail-body">
        <section id="subtitles" className="section section-subs" aria-labelledby="h-subs">
          <SectionHead kicker={`Subtitles • ${subtitles.length}`} title={<span id="h-subs">උපසිරැසි බාගත කිරීම්</span>} />
          {subtitles.length > 0 ? (
            <>
              <ul className="subs">
                {subtitles.map((s) => <SubtitleItem key={s.id} sub={s} />)}
              </ul>
              <p className="fine">
                <Info /> බාගත කිරීම Google Drive හරහා සිදුවේ. ඔබේ වීඩියෝ පිටපතට (release) ගැළපෙන අනුවාදය තෝරන්න. මෙහි ඇත්තේ උපසිරැසි ගොනු පමණි — චිත්‍රපටය නීත්‍යානුකූලව ලබාගන්න.
                {' '}<Link to="/copyright/#contact">ගැටලුවක් වාර්තා කරන්න</Link>
              </p>
            </>
          ) : (
            <Empty icon={Captions} title="උපසිරැසි තවම නොමැත">මෙම චිත්‍රපටය සඳහා උපසිරැසියක් ප්‍රකාශයට පත් කළ විගස එය මෙහි දිස්වනු ඇත.</Empty>
          )}
        </section>

        <section id="trailer" className="section" aria-labelledby="h-trailer">
          <SectionHead kicker="Official trailer" title={<span id="h-trailer">ට්‍රේලරය</span>} />
          <TrailerPlayer videoId={movie.youtube_video_id} title={movie.title} />
        </section>

        {related.length > 0 && (
          <section className="section" aria-labelledby="h-related">
            <SectionHead kicker="More like this" title={<span id="h-related">තවත් {langName(movie.language)} චිත්‍රපට</span>} to={`/browse/?lang=${movie.language}`} />
            <Rail label="සමාන චිත්‍රපට">
              {related.map((m) => <MovieCard key={m.id} movie={m} />)}
            </Rail>
          </section>
        )}
      </div>
    </article>
  )
}
