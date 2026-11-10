import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useSearchParams } from 'react-router-dom'
import { Search, Menu, X, House, Globe, ChevronRight } from 'lucide-react'
import Logo from './Logo.jsx'
import SearchOverlay from './SearchOverlay.jsx'
import { useSettings } from '../context/SettingsContext.jsx'

export default function Header() {
  const { settings } = useSettings()
  const location = useLocation()
  const [params] = useSearchParams()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const activeLang = location.pathname.startsWith('/browse') ? params.get('lang') || '' : null

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
    setSearchOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    document.body.classList.toggle('no-scroll', menuOpen || searchOpen)
    return () => document.body.classList.remove('no-scroll')
  }, [menuOpen, searchOpen])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && !/input|textarea|select/i.test(e.target.tagName) && !e.target.isContentEditable) {
        e.preventDefault()
        setSearchOpen(true)
      }
      if (e.key === 'Escape') {
        setMenuOpen(false)
        setSearchOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const cats = [...settings.categories, { code: 'other', en: 'Other', si: 'වෙනත්' }]

  return (
    <>
      <header className={`header${scrolled ? ' is-scrolled' : ''}`}>
        <div className="wrap header-inner">
          <Link to="/" className="header-logo" aria-label={`${settings.site_name} — මුල් පිටුව`}>
            <Logo />
          </Link>

          <nav className="nav" aria-label="ප්‍රධාන මෙනුව">
            <NavLink to="/" end className="nav-link">
              මුල් පිටුව
            </NavLink>
            {cats.map((c) => (
              <Link key={c.code} to={`/browse/?lang=${c.code}`} className={`nav-link${activeLang === c.code ? ' active' : ''}`} title={`${c.en} movies — Sinhala subtitles`}>
                {c.si}
              </Link>
            ))}
          </nav>

          <div className="header-actions">
            <button className="search-trigger" onClick={() => setSearchOpen(true)} aria-label="සොයන්න (Search)">
              <Search />
              <span>චිත්‍රපටයක් සොයන්න…</span>
              <kbd>/</kbd>
            </button>
            <button className="icon-btn menu-btn" onClick={() => setMenuOpen(true)} aria-label="මෙනුව විවෘත කරන්න" aria-expanded={menuOpen}>
              <Menu />
            </button>
          </div>
        </div>
      </header>

      <div className={`drawer${menuOpen ? ' is-open' : ''}`} aria-hidden={!menuOpen}>
        <button className="drawer-backdrop" onClick={() => setMenuOpen(false)} aria-label="මෙනුව වසන්න" tabIndex={menuOpen ? 0 : -1} />
        <aside className="drawer-panel" role="dialog" aria-modal="true" aria-label="මෙනුව">
          <div className="drawer-head">
            <Logo size={32} />
            <button className="icon-btn" onClick={() => setMenuOpen(false)} aria-label="වසන්න" tabIndex={menuOpen ? 0 : -1}>
              <X />
            </button>
          </div>
          <nav className="drawer-nav">
            <Link to="/" tabIndex={menuOpen ? 0 : -1}>
              <House /> <span>මුල් පිටුව</span> <small>Home</small> <ChevronRight className="chev" />
            </Link>
            {cats.map((c) => (
              <Link key={c.code} to={`/browse/?lang=${c.code}`} className={activeLang === c.code ? 'active' : ''} tabIndex={menuOpen ? 0 : -1}>
                <Globe /> <span>{c.si}</span> <small>{c.en}</small> <ChevronRight className="chev" />
              </Link>
            ))}
          </nav>
          <div className="drawer-foot">
            <Link to="/copyright/" tabIndex={menuOpen ? 0 : -1}>අප අමතන්න</Link>
            <Link to="/about/" tabIndex={menuOpen ? 0 : -1}>අප ගැන</Link>
            <Link to="/privacy/" tabIndex={menuOpen ? 0 : -1}>Privacy</Link>
            <Link to="/terms/" tabIndex={menuOpen ? 0 : -1}>Terms</Link>
          </div>
        </aside>
      </div>

      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
    </>
  )
}
