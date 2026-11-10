import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, ArrowUpRight, ArrowRight, Play, Captions, Film } from 'lucide-react'
import { searchMovies } from '../services/movies.js'
import { useSettings } from '../context/SettingsContext.jsx'
import { useSeo } from '../lib/seo.js'
import { moviePath, tmdbSize } from '../lib/format.js'
import { langName } from '../lib/constants.js'
import MovieCard, { Poster } from '../components/MovieCard.jsx'
import Moonstone from '../components/Moonstone.jsx'
import Rail, { SectionHead } from '../components/Rail.jsx'
import { ErrorState, NoMovies, SkeletonCards } from '../components/States.jsx'

/** Branded hero artwork shown while the catalogue is still empty (no movie data is invented). */
function BrandScreen() {
  return (
    <div className="screen" aria-hidden="true">
      <Moonstone />
      <div className="screen-cap">
        <span>චිත්‍රපට ලෝකය දැන්</span>
        <span>සිංහලෙන් අත්විඳින්න</span>
      </div>
    </div>
  )
}

const metaLine = (m) => [m.release_year, langName(m.language)].filter(Boolean).join(' • ')

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
      <section className={`hero${spotlight ? ' has-backdrop' : ''}`}>
        <div className="hero-bg" aria-hidden="true">
          {spotlight && <img src={tmdbSize(spotlight.backdrop_url, 'w1280')} alt="" fetchpriority="high" decoding="async" />}
        </div>
        <div className="wrap hero-inner">
          <div className="hero-copy">
            <p className="hero-kicker">
              <b>{settings.site_name}</b><i /><span>{settings.tagline}</span>
            </p>
            <h1>
              ඔබේ ප්‍රියතම චිත්‍රපටයට <em>සිංහල උපසිරැසි</em> සොයාගන්න.
            </h1>
            <p className="hero-lead">චිත්‍රපට ලෝකය දැන් සිංහලෙන් අත්විඳින්න.</p>

            <form className="hero-search" onSubmit={submit} role="search">
              <Search aria-hidden="true" />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="චිත්‍රපටයේ නම හෝ වසර…" aria-label="චිත්‍රපට සොයන්න" enterKeyHint="search" />
              <button className="btn" type="submit">සොයන්න</button>
            </form>

            <div className="hero-actions">
              <Link className="btn btn-light" to="/browse/?sort=recent">
                <Film /> චිත්‍රපට බලන්න
              </Link>
              <Link className="btn btn-ghost" to="/browse/">
                අලුත්ම උපසිරැසි <ArrowRight />
              </Link>
            </div>

            <p className="hero-langs" aria-label="භාෂා කාණ්ඩ">
              <span>භාෂාව අනුව</span>
              {cats.map((c) => (
                <Link key={c.code} to={`/browse/?lang=${c.code}`} title={`${c.en} movies`}>
                  {c.si}
                </Link>
              ))}
            </p>
          </div>

          <div className="hero-art">
            {fan.length > 0 ? (
              <>
                <Moonstone className="hero-rings" />
                <div className={`feature feature-${fan.length}`}>
                  <Link to={moviePath(fan[0])} className="feature-main">
                    <Poster src={fan[0].poster_url} title={fan[0].title} eager sizes="(max-width: 1000px) 96px, 260px" />
                    <span className="feature-cap">
                      <small>{fan[0].subtitle_count > 0 ? 'අලුත්ම උපසිරැසිය' : 'අලුතින් එක් කළා'}</small>
                      <strong>{fan[0].title}</strong>
                      <span>{metaLine(fan[0])}</span>
                    </span>
                  </Link>
                  {fan.length > 1 && (
                    <div className="feature-side">
                      {fan.slice(1).map((m) => (
                        <Link key={m.id} to={moviePath(m)} className="feature-mini" aria-label={m.title}>
                          <Poster src={m.poster_url} title={m.title} eager sizes="130px" />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              !loading && <BrandScreen />
            )}
          </div>
        </div>
      </section>

      <div className="wrap home">
        {state.status === 'error' && <ErrorState error={state.error} onRetry={load} />}
        {isEmpty && <NoMovies />}

        {(loading || (state.status === 'done' && state.latest.length > 0)) && (
          <section className="section" aria-labelledby="h-latest">
            <SectionHead kicker="Latest subtitles" title={<span id="h-latest">අලුත්ම උපසිරැසි</span>} to="/browse/?sort=latest" />
            <Rail>
              {loading ? <SkeletonCards count={7} /> : state.latest.map((m) => <MovieCard key={m.id} movie={m} />)}
            </Rail>
          </section>
        )}

        {state.status === 'done' && state.popular.length > 0 && (
          <section className="section" aria-labelledby="h-popular">
            <SectionHead kicker="Most downloaded" title={<span id="h-popular">ජනප්‍රිය චිත්‍රපට</span>} to="/browse/?sort=popular" />
            <Rail>
              {state.popular.map((m, i) => (
                <MovieCard key={m.id} movie={m} rank={i + 1} showDownloads />
              ))}
            </Rail>
          </section>
        )}

        <section className="section" aria-labelledby="h-cats">
          <SectionHead kicker="Browse by language" title={<span id="h-cats">භාෂාව අනුව තෝරන්න</span>} />
          <div className="cats">
            {cats.map((c) => (
              <Link key={c.code} to={`/browse/?lang=${c.code}`} className="cat">
                <span className="cat-code" aria-hidden="true">{c.code === 'other' ? '+' : c.code.toUpperCase()}</span>
                <span className="cat-name">{c.si}</span>
                <span className="cat-sub">{c.en} movies</span>
                <ArrowUpRight className="cat-arrow" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>

        {(loading || (state.status === 'done' && state.recent.length > 0)) && (
          <section className="section" aria-labelledby="h-recent">
            <SectionHead kicker="Recently added" title={<span id="h-recent">අලුතින් එකතු කළ චිත්‍රපට</span>} to="/browse/?sort=recent" />
            <div className="grid">
              {loading ? <SkeletonCards count={12} /> : state.recent.map((m) => <MovieCard key={m.id} movie={m} />)}
            </div>
          </section>
        )}

        <section className="how" aria-labelledby="h-how">
          <div className="how-head">
            <p className="kicker">How it works</p>
            <h2 id="h-how">පියවර තුනකින් සිංහල උපසිරැසි</h2>
            <p>{settings.description}</p>
          </div>
          <ol className="steps">
            <li className="step"><span className="step-no" aria-hidden="true">01</span><Search aria-hidden="true" /><h3>සොයන්න</h3><p>චිත්‍රපටයේ නම, වසර හෝ භාෂාව අනුව ඉක්මනින් සොයාගන්න.</p></li>
            <li className="step"><span className="step-no" aria-hidden="true">02</span><Play aria-hidden="true" /><h3>ට්‍රේලරය නරඹන්න</h3><p>නිල YouTube ට්‍රේලරය මෙතැනින්ම නරඹා චිත්‍රපටය තෝරාගන්න.</p></li>
            <li className="step"><span className="step-no" aria-hidden="true">03</span><Captions aria-hidden="true" /><h3>උපසිරැසිය බාගන්න</h3><p>ඔබේ පිටපතට ගැළපෙන සිංහල උපසිරැසිය එක ක්ලික් එකකින්.</p></li>
          </ol>
        </section>
      </div>
    </>
  )
}
