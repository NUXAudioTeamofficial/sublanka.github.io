import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Sparkles, Flame, Clapperboard, ArrowUpRight, Play, Download, Captions, Languages } from 'lucide-react'
import { searchMovies } from '../services/movies.js'
import { useSettings } from '../context/SettingsContext.jsx'
import { useSeo } from '../lib/seo.js'
import { moviePath, tmdbSize } from '../lib/format.js'
import MovieCard, { Poster } from '../components/MovieCard.jsx'
import Rail, { SectionHead } from '../components/Rail.jsx'
import { ErrorState, NoMovies, SkeletonCards } from '../components/States.jsx'

function CaptionDemo() {
  return (
    <div className="demo" aria-hidden="true">
      <div className="demo-screen">
        <span className="demo-play"><Play /></span>
        <div className="demo-caption">
          <span>සිංහල උපසිරැසි සමඟ</span>
          <span>ඔබේ ප්‍රියතම චිත්‍රපටය රසවිඳින්න</span>
        </div>
        <div className="demo-bar"><i /></div>
      </div>
      <div className="demo-tags">
        <span><Search /> Find</span>
        <span><Play /> Trailers</span>
        <span><Download /> Download</span>
      </div>
    </div>
  )
}

export default function Home() {
  const { settings } = useSettings()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [state, setState] = useState({ status: 'loading' })
  const cats = [...settings.categories, { code: 'other', en: 'Other', si: 'වෙනත්' }]

  useSeo({
    title: '',
    description: `${settings.description} Find Sinhala subtitles, watch trailers and download.`,
    path: '/',
    siteName: settings.site_name,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: settings.site_name,
      alternateName: settings.tagline,
      inLanguage: 'si',
    },
  })

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const categories = settings.categories
      const [latest, popular, recent] = await Promise.all([
        searchMovies({ sort: 'latest', withSubs: true, pageSize: 14, categories }),
        searchMovies({ sort: 'popular', withSubs: true, pageSize: 10, categories }),
        searchMovies({ sort: 'recent', pageSize: 12, categories }),
      ])
      setState({ status: 'done', latest, popular: popular.filter((m) => m.total_downloads > 0), recent })
    } catch (error) {
      setState({ status: 'error', error })
    }
  }, [settings.categories])

  useEffect(() => {
    load()
  }, [load])

  const submit = (e) => {
    e.preventDefault()
    navigate(q.trim() ? `/browse/?q=${encodeURIComponent(q.trim())}` : '/browse/')
  }

  const loading = state.status === 'loading'
  const all = state.status === 'done' ? [...state.latest, ...state.recent] : []
  const spotlight = all.find((m) => m.backdrop_url)
  const fan = [...new Map(all.filter((m) => m.poster_url).map((m) => [m.id, m])).values()].slice(0, 3)
  const isEmpty = state.status === 'done' && state.recent.length === 0

  return (
    <>
      <section className="hero">
        <div className="hero-bg" aria-hidden="true">
          {spotlight && <img src={tmdbSize(spotlight.backdrop_url, 'w1280')} alt="" fetchpriority="high" decoding="async" />}
        </div>
        <div className="wrap hero-inner">
          <div className="hero-copy">
            <p className="hero-kicker">
              <span>Find</span><i /><span>Watch trailers</span><i /><span>Download</span>
            </p>
            <h1>
              <span className="grad-text">සිංහල උපසිරැසි</span> ලෝකය
            </h1>
            <p className="hero-lead">{settings.description}</p>

            <form className="hero-search" onSubmit={submit} role="search">
              <Search aria-hidden="true" />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="චිත්‍රපටයේ නම හෝ වසර…" aria-label="චිත්‍රපට සොයන්න" enterKeyHint="search" />
              <button className="btn" type="submit">සොයන්න</button>
            </form>

            <div className="hero-chips" aria-label="භාෂා කාණ්ඩ">
              {cats.map((c) => (
                <Link key={c.code} to={`/browse/?lang=${c.code}`} className="chip">
                  {c.si} <small>{c.en}</small>
                </Link>
              ))}
            </div>
          </div>

          <div className="hero-art">
            {fan.length > 0 ? (
              <div className={`fan fan-${fan.length}`}>
                {fan.map((m, i) => (
                  <Link key={m.id} to={moviePath(m)} className="fan-card" style={{ '--i': i }} aria-label={m.title}>
                    <Poster src={m.poster_url} title={m.title} eager sizes="260px" />
                    {i === 0 && (
                      <span className="fan-label">
                        <Sparkles /> නවතම <b>{m.title}</b>
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              !loading && <CaptionDemo />
            )}
          </div>
        </div>
      </section>

      <div className="wrap home">
        {state.status === 'error' && <ErrorState error={state.error} onRetry={load} />}
        {isEmpty && <NoMovies />}

        {(loading || (state.status === 'done' && state.latest.length > 0)) && (
          <section className="section" aria-labelledby="h-latest">
            <SectionHead kicker="Latest subtitles" icon={Sparkles} title={<span id="h-latest">නවතම උපසිරැසි</span>} to="/browse/?sort=latest" />
            <Rail label="නවතම උපසිරැසි">
              {loading ? <SkeletonCards count={7} /> : state.latest.map((m) => <MovieCard key={m.id} movie={m} />)}
            </Rail>
          </section>
        )}

        {state.status === 'done' && state.popular.length > 0 && (
          <section className="section" aria-labelledby="h-popular">
            <SectionHead kicker="Popular subtitles" icon={Flame} title={<span id="h-popular">ජනප්‍රිය උපසිරැසි</span>} to="/browse/?sort=popular" />
            <Rail label="ජනප්‍රිය උපසිරැසි">
              {state.popular.map((m, i) => (
                <MovieCard key={m.id} movie={m} rank={i + 1} showDownloads />
              ))}
            </Rail>
          </section>
        )}

        <section className="section" aria-labelledby="h-cats">
          <SectionHead kicker="Browse by language" icon={Languages} title={<span id="h-cats">භාෂාව අනුව තෝරන්න</span>} />
          <div className="cats">
            {cats.map((c, i) => (
              <Link key={c.code} to={`/browse/?lang=${c.code}`} className="cat" style={{ '--h': 258 + i * 14 }}>
                <span className="cat-code" aria-hidden="true">{c.code === 'other' ? '+' : c.code.toUpperCase()}</span>
                <span className="cat-name">{c.si}</span>
                <span className="cat-sub">{c.en} movies <ArrowUpRight /></span>
              </Link>
            ))}
          </div>
        </section>

        {(loading || (state.status === 'done' && state.recent.length > 0)) && (
          <section className="section" aria-labelledby="h-recent">
            <SectionHead kicker="Recently added movies" icon={Clapperboard} title={<span id="h-recent">මෑතකදී එක් කළ චිත්‍රපට</span>} to="/browse/?sort=recent" />
            <div className="grid">
              {loading ? <SkeletonCards count={12} /> : state.recent.map((m) => <MovieCard key={m.id} movie={m} />)}
            </div>
          </section>
        )}

        <section className="steps" aria-label="භාවිත කරන ආකාරය">
          <div className="step"><span><Search /></span><h3>සොයන්න</h3><p>චිත්‍රපටයේ නම, වසර හෝ භාෂාව අනුව ඉක්මනින් සොයාගන්න.</p></div>
          <div className="step"><span><Play /></span><h3>ට්‍රේලරය නරඹන්න</h3><p>නිල YouTube ට්‍රේලරය මෙතැනින්ම නරඹා චිත්‍රපටය තෝරාගන්න.</p></div>
          <div className="step"><span><Captions /></span><h3>උපසිරැසිය බාගන්න</h3><p>ඔබේ පිටපතට ගැළපෙන සිංහල උපසිරැසිය එක ක්ලික් එකකින්.</p></div>
        </section>
      </div>
    </>
  )
}
