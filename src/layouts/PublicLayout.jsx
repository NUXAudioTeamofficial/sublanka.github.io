import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from '../components/Header.jsx'
import Footer from '../components/Footer.jsx'

function ScrollManager() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0)
      return undefined
    }
    // The target can arrive a moment later (page text or movie data still loading): keep looking briefly.
    let tries = 0
    let timer
    const jump = () => {
      const el = document.getElementById(decodeURIComponent(hash.slice(1)))
      if (el) el.scrollIntoView()
      else if (tries++ < 20) timer = setTimeout(jump, 100)
      else window.scrollTo(0, 0)
    }
    jump()
    return () => clearTimeout(timer)
  }, [pathname, hash])
  return null
}

export default function PublicLayout() {
  const { pathname } = useLocation()
  // The very first page must paint at once (a fade from invisible would delay it);
  // only later page changes fade in.
  const first = useRef(pathname)
  if (first.current !== null && first.current !== pathname) first.current = null
  return (
    <div className="site">
      <a className="skip-link" href="#main">අන්තර්ගතයට යන්න</a>
      <ScrollManager />
      <Header />
      <main id="main">
        {/* Re-keyed per page (not per filter change) so each page fades in. */}
        <div className={first.current === null ? 'route route-enter' : 'route'} key={pathname}>
          <Outlet />
        </div>
      </main>
      <Footer />
    </div>
  )
}
